import { z } from "zod";
import {
  EvaluationFailedError,
} from "@/domain/errors/DomainError";
import type { EvaluationResult } from "@/domain/evaluation/EvaluationResult";

/**
 * Contract for the LLM's answer. Validated with zod BEFORE anything is
 * persisted — the AI's output is data to verify, not truth to trust.
 * Malformed responses fail loudly (→ attempt FAILED, learner can retry),
 * never silently degrade into a guessed score.
 */

const severity = z.enum(["low", "medium", "high"]);

const category = z.enum([
  "responsibility",
  "abstraction",
  "encapsulation",
  "coupling",
  "cohesion",
  "extensibility",
  "behaviour",
  "patterns",
  "tradeoffs",
  "completeness",
]);

export const llmEvaluationSchema = z.object({
  overallScore: z.number().min(0).max(100),
  summary: z.string().min(10).max(1200),
  strengths: z
    .array(
      z.object({
        title: z.string().min(3).max(140),
        explanation: z.string().min(3).max(1000),
      }),
    )
    .max(8),
  issues: z
    .array(
      z.object({
        severity,
        category,
        title: z.string().min(3).max(180),
        explanation: z.string().min(10).max(1600),
        suggestion: z.string().min(3).max(1200),
        example: z.string().max(1600).optional(),
      }),
    )
    .max(12),
  requirements: z
    .array(
      z.object({
        requirementId: z.string(),
        covered: z.boolean(),
        explanation: z.string().max(800),
      }),
    )
    .max(20),
  dimensions: z
    .array(
      z.object({
        name: z.string().min(2).max(60),
        score: z.number().min(0).max(100),
        explanation: z.string().max(800),
      }),
    )
    .min(1)
    .max(10),
  suggestions: z
    .array(
      z.object({
        title: z.string().min(3).max(180),
        detail: z.string().min(3).max(1200),
      }),
    )
    .max(8),
});

export type LlmEvaluationOutput = z.infer<typeof llmEvaluationSchema>;

/**
 * Extracts the outermost balanced JSON object from model chatter.
 * Reasoning models often mix prose (which may contain braces) with the JSON
 * payload, so we scan for a brace-balanced, string-aware object and try to
 * parse each candidate rather than naively slicing first-{ to last-}.
 */
export function extractJson(text: string): unknown {
  const cleaned = text
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  for (const candidate of findBalancedObjects(cleaned)) {
    try {
      return JSON.parse(candidate);
    } catch {
      // try the next balanced object
    }
  }
  throw new EvaluationFailedError("no parseable JSON object found in model response");
}

/** Yields string-aware balanced {...} substrings, outermost-first. */
function* findBalancedObjects(text: string): Generator<string> {
  let start = text.indexOf("{");
  while (start !== -1) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') inString = true;
      else if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          yield text.slice(start, i + 1);
          break;
        }
      }
    }
    start = text.indexOf("{", start + 1);
  }
}

/**
 * Deterministic, pre-validation shape coercion. LLMs are reliably right
 * about CONTENT and occasionally sloppy about CONTAINER shape (a
 * `requirements` map keyed by id instead of an array, scores as strings).
 * We normalise the small set of known container variations, then the zod
 * schema still decides pass/fail — coercion never widens acceptance.
 */
export function coerceLlmShape(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const obj: Record<string, unknown> = { ...(raw as Record<string, unknown>) };

  const containerKey: Record<string, string> = {
    requirements: "requirementId",
    issues: "title",
    strengths: "title",
    dimensions: "name",
    suggestions: "title",
  };
  for (const [key, idField] of Object.entries(containerKey)) {
    const value = obj[key];
    if (value !== undefined && !Array.isArray(value) && value !== null && typeof value === "object") {
      obj[key] = Object.entries(value as Record<string, unknown>).map(([k, v]) =>
        v !== null && typeof v === "object" && !Array.isArray(v)
          ? { [idField]: k, ...(v as object) }
          : { [idField]: k },
      );
    }
  }

  if (typeof obj.overallScore === "string" && obj.overallScore.trim() !== "") {
    const n = Number(obj.overallScore);
    if (!Number.isNaN(n)) obj.overallScore = n;
  }
  if (Array.isArray(obj.dimensions)) {
    obj.dimensions = (obj.dimensions as Record<string, unknown>[]).map((d) => {
      if (d && typeof d.score === "string" && d.score.trim() !== "") {
        const n = Number(d.score);
        if (!Number.isNaN(n)) return { ...d, score: n };
      }
      return d;
    });
  }
  return obj;
}

export function parseLlmEvaluation(raw: unknown): LlmEvaluationOutput {
  const parsed = llmEvaluationSchema.safeParse(coerceLlmShape(raw));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new EvaluationFailedError(
      `model response failed schema validation: ${first?.path.join(".") ?? "?"} — ${first?.message ?? "unknown"}`,
    );
  }
  return parsed.data;
}

/** Type guard so EvaluationResult construction sites stay honest. */
export function asEvaluationResult(result: EvaluationResult): EvaluationResult {
  return result;
}
