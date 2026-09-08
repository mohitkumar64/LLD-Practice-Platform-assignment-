import type { Problem } from "@/domain/problem/Problem";
import type { StructuredDesignSubmission } from "@/domain/submission/StructuredDesignSubmission";
import type { Evaluator } from "@/domain/evaluation/Evaluator";
import type { EvaluationResult } from "@/domain/evaluation/EvaluationResult";
import { EvaluationFailedError } from "@/domain/errors/DomainError";
import { NvidiaLlmClient } from "./NvidiaLlmClient";
import { extractJson, parseLlmEvaluation } from "./LlmEvaluationSchema";

/**
 * Role framing: a senior engineer doing a design review, not a grader with
 * an answer key. The JSON contract is restated in the user prompt; here we
 * set the review principles that keep feedback explainable and grounded.
 */
const SYSTEM_PROMPT = `You are a senior software engineer conducting a low-level design review for a learner.

Your job is to evaluate the QUALITY of design decisions, not to match a reference solution. LLD problems have many valid designs.

Core principles:
- Ground every observation in the learner's actual class names, methods, and relationships. Never give generic feedback.
- Each issue must follow the pattern: what was detected -> why it matters -> how to improve. Cite the learner's types by name.
- Never reward a design pattern merely for being mentioned. Judge whether it solves a real problem in this specific design.
- Evaluate extensibility concretely: consider plausible requirement changes and how much code would need to change.
- Be honest and calibrated: 85+ is exceptional interview-level work; 60-75 is competent with real flaws; below 40 means fundamentals are missing.
- Respond with a single JSON object and nothing else.`;

/**
 * LlmDesignEvaluator — the reasoning half of the review.
 *
 * The prompt frames the AI as a senior engineer doing a design review, NOT
 * as a grader with a hidden answer key. It explicitly instructs:
 *  - there are many valid designs; judge the decisions, not similarity to a
 *    reference;
 *  - patterns must EARN their place — mentioning one is not using it well;
 *  - every issue must follow what/why/how, grounded in the actual submission.
 *
 * Output is forced into a strict JSON shape and schema-validated; a malformed
 * response is retried once and then fails the evaluation (attempt → FAILED),
 * which the learner can retry. The AI never silently scores a submission.
 */
export class LlmDesignEvaluator implements Evaluator {
  constructor(
    private readonly client: NvidiaLlmClient,
    private readonly maxTokens = 4096,
  ) {}

  async evaluate(
    problem: Problem,
    submission: StructuredDesignSubmission,
  ): Promise<EvaluationResult> {
    const userPrompt = this.buildUserPrompt(problem, submission);
    try {
      const raw = await this.client.completeText(SYSTEM_PROMPT, userPrompt, this.maxTokens);
      return this.buildResult(raw, problem);
    } catch (err) {
      if (!(err instanceof EvaluationFailedError)) {
        throw err;
      }
      // Log the malformed output (truncated) — indispensable when tuning the
      // prompt contract, and it keeps failures diagnosable.
      console.info("[llm] malformed evaluation response from model");
      // One corrective retry — reasoning models sometimes wrap the JSON in
      // prose or use the wrong keys. The retry names the exact violation.
      const retryRaw = await this.client.completeText(
        SYSTEM_PROMPT,
        `${userPrompt}

Your previous response was rejected: ${err.message}
The top-level JSON object MUST have exactly these keys: "overallScore" (number 0-100), "summary" (string), "strengths" (array), "issues" (array), "requirements" (array), "dimensions" (array), "suggestions" (array). Respond with ONLY that JSON object — no prose, no markdown fences.`,
        this.maxTokens,
      );
      return this.buildResult(retryRaw, problem);
    }
  }

  private buildResult(raw: string, problem: Problem): EvaluationResult {
    const parsed = parseLlmEvaluation(extractJson(raw));

    const coverageById = new Map(parsed.requirements.map((r) => [r.requirementId, r]));
    const requirementCoverage = problem.requirements.map((req) => {
      const match = coverageById.get(req.id);
      return {
        requirementId: req.id,
        requirement: req.description,
        covered: match?.covered ?? false,
        explanation:
          match?.explanation ??
          "The reviewer did not comment on this requirement specifically.",
      };
    });

    return {
      overallScore: Math.min(100, Math.max(0, Math.round(parsed.overallScore))),
      summary: parsed.summary,
      strengths: parsed.strengths,
      issues: parsed.issues.map((i) => ({ ...i, example: i.example ?? undefined })),
      requirementCoverage,
      dimensions: parsed.dimensions,
      suggestions: parsed.suggestions,
      sources: {
        deterministic: { score: 0, checks: [] },
        llmContributed: true,
        llmModel: this.client.getModel(),
      },
    };
  }

  private buildUserPrompt(problem: Problem, submission: StructuredDesignSubmission): string {
    const requirements = problem.requirements
      .map((r) => `- [${r.id}] ${r.description}`)
      .join("\n");

    return `You are reviewing a learner's LOW-LEVEL DESIGN submission.

## Problem: ${problem.title}
${problem.statement}

### Functional requirements
${requirements}

### Assumptions the learner was given
${problem.assumptions.map((a) => `- ${a}`).join("\n")}

## Learner's submission (JSON)
${JSON.stringify(
  {
    entities: submission.entities,
    relationships: submission.relationships,
    patterns: submission.patterns,
    tradeoffs: submission.tradeoffs,
    pseudocode: submission.pseudocode,
  },
  null,
  2,
)}

## Your task
Act as a senior engineer doing a design review. Respond with ONLY a JSON object (no prose, no markdown fences) matching exactly this shape:

{
  "overallScore": <0-100 integer>,
  "summary": "<3-5 sentences: the single most important takeaway for this learner>",
  "strengths": [{ "title": "...", "explanation": "..." }],
  "issues": [{
    "severity": "low|medium|high",
    "category": "responsibility|abstraction|encapsulation|coupling|cohesion|extensibility|behaviour|patterns|tradeoffs|completeness",
    "title": "<what was detected>",
    "explanation": "<why it matters, referencing the learner's actual types/methods>",
    "suggestion": "<a direction to improve, not a full solution>",
    "example": "<optional short sketch of the better approach>"
  }],
  "requirements": [{ "requirementId": "<from the list above>", "covered": <bool>, "explanation": "<how the design does or does not address it>" }],
  "dimensions": [{ "name": "<e.g. Responsibility|Abstraction|Encapsulation|Coupling|Cohesion|Extensibility|Behaviour>", "score": <0-100>, "explanation": "<one sentence>" }],
  "suggestions": [{ "title": "...", "detail": "<concrete next step for the next attempt>" }]
}

Review principles:
1. There are MANY valid designs. Judge the quality of decisions; never penalise a design merely for differing from a common reference solution.
2. Every issue MUST reference the learner's actual types or methods by name. Generic feedback like "high coupling" without naming the types is worthless.
3. Do not reward pattern names alone. If a pattern is declared, judge whether it solves a real problem in THIS design; if it is decorative, say so.
4. Check extensibility concretely: pick 1-2 plausible requirement changes (e.g. "add a new vehicle type", "add a new payment method") and assess how much of this design would need to change.
5. Identify 2-5 real issues at most — depth beats volume. Empty issues array is valid for a strong design.
6. Score honestly: 85+ is genuinely strong interview-level work, 60-75 is competent with real flaws, below 40 means fundamentals are missing.`;
  }
}
