import type { Problem } from "../problem/Problem";
import type { StructuredDesignSubmission } from "../submission/StructuredDesignSubmission";
import type { EvaluationResult } from "./EvaluationResult";

/**
 * The single abstraction the application layer depends on for evaluation.
 * The AI provider lives behind this port in infrastructure; the domain never
 * knows which evaluator (or provider) is running.
 *
 * Implementations: RuleBasedEvaluator (deterministic), LlmDesignEvaluator
 * (AI reasoning), HybridEvaluator (compose both). Tests substitute fakes.
 */
export interface Evaluator {
  evaluate(problem: Problem, submission: StructuredDesignSubmission): Promise<EvaluationResult>;
}
