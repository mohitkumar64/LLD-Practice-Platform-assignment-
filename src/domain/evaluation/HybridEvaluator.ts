import type { Problem } from "../problem/Problem";
import type { StructuredDesignSubmission } from "../submission/StructuredDesignSubmission";
import type { Evaluator } from "./Evaluator";
import type {
  DeterministicCheck,
  EvaluationIssue,
  EvaluationResult,
  RequirementCoverage,
} from "./EvaluationResult";

const clamp = (n: number): number => Math.min(100, Math.max(0, Math.round(n)));

export interface HybridWeights {
  /** Weight of the deterministic score in the final blend. */
  deterministic: number;
  /** Weight of the LLM score in the final blend. */
  llm: number;
}

export const DEFAULT_WEIGHTS: HybridWeights = { deterministic: 0.3, llm: 0.7 };

/**
 * HybridEvaluator — deterministic checks + LLM reasoning = one result.
 *
 * Division of labour:
 *  - Rules produce FACTS (completeness, consistency, keyword coverage).
 *    They are objective, instant, and cheap.
 *  - The LLM produces JUDGMENT (coupling, cohesion, extensibility, pattern
 *    appropriateness, trade-off quality), given those facts as evidence.
 *  - The merge is explicit and explainable: the final score is a weighted
 *    blend of both sources, requirement coverage prefers the LLM's reasoned
 *    verdict but keeps the deterministic explanation when the LLM is silent,
 *    and every issue records whether it came from rules or reasoning.
 *
 * Deliberately NOT a "pick whichever evaluator you like" strategy selector:
 * the hybrid is the product. The `Evaluator` interface (not this class) is
 * the extensibility point — tests substitute whole fakes for it.
 */
export class HybridEvaluator implements Evaluator {
  constructor(
    private readonly rules: Evaluator,
    private readonly llm: Evaluator,
    private readonly weights: HybridWeights = DEFAULT_WEIGHTS,
  ) {}

  async evaluate(
    problem: Problem,
    submission: StructuredDesignSubmission,
  ): Promise<EvaluationResult> {
    const deterministic = await this.rules.evaluate(problem, submission);
    const reasoned = await this.llm.evaluate(problem, submission);

    const overallScore = clamp(
      deterministic.overallScore * this.weights.deterministic +
        reasoned.overallScore * this.weights.llm,
    );

    const issues: EvaluationIssue[] = [
      ...deterministic.issues.map((i) => ({ ...i, title: `[structural] ${i.title}` })),
      ...reasoned.issues,
    ];
    issues.sort((a, b) => severityRank(b.severity) - severityRank(a.severity));

    const requirementCoverage = mergeCoverage(
      deterministic.requirementCoverage,
      reasoned.requirementCoverage,
    );

    return {
      overallScore,
      summary: reasoned.summary,
      strengths: mergeStrengths(deterministic, reasoned),
      issues,
      requirementCoverage,
      dimensions: mergeDimensions(deterministic, reasoned),
      suggestions: reasoned.suggestions,
      sources: {
        deterministic: deterministic.sources.deterministic,
        llmContributed: true,
        llmModel: reasoned.sources.llmModel,
      },
    };
  }
}

function severityRank(severity: EvaluationIssue["severity"]): number {
  return severity === "high" ? 3 : severity === "medium" ? 2 : 1;
}

function mergeCoverage(
  deterministic: RequirementCoverage[],
  reasoned: RequirementCoverage[],
): RequirementCoverage[] {
  const byId = new Map(deterministic.map((d) => [d.requirementId, d]));
  return reasoned.map((r) => {
    const d = byId.get(r.requirementId);
    return {
      requirementId: r.requirementId,
      requirement: r.requirement,
      covered: r.covered,
      explanation: r.explanation || d?.explanation || "",
    };
  });
}

function mergeStrengths(
  deterministic: EvaluationResult,
  reasoned: EvaluationResult,
): EvaluationResult["strengths"] {
  const seen = new Set(reasoned.strengths.map((s) => s.title.toLowerCase()));
  const extras = deterministic.strengths.filter((s) => !seen.has(s.title.toLowerCase()));
  return [...reasoned.strengths, ...extras].slice(0, 6);
}

function mergeDimensions(
  deterministic: EvaluationResult,
  reasoned: EvaluationResult,
): EvaluationResult["dimensions"] {
  const detByScore = (name: string): number | null =>
    deterministic.dimensions.find((d) => d.name.toLowerCase() === name.toLowerCase())?.score ?? null;

  const merged = reasoned.dimensions.map((d) => {
    const det = detByScore(d.name);
    return det === null ? d : { ...d, score: clamp(d.score * 0.8 + det * 0.2) };
  });

  for (const d of deterministic.dimensions) {
    if (!merged.some((m) => m.name.toLowerCase() === d.name.toLowerCase())) {
      merged.push(d);
    }
  }
  return merged;
}
