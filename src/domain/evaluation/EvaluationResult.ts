/**
 * EvaluationResult — the structured contract every evaluator must produce.
 *
 * The AI evaluator never returns free-form prose: the shape below is the
 * contract, validated before it is persisted. Learners see every field
 * rendered; nothing is "stored but invisible".
 */

export type Severity = "low" | "medium" | "high";

export type IssueCategory =
  | "responsibility"
  | "abstraction"
  | "encapsulation"
  | "coupling"
  | "cohesion"
  | "extensibility"
  | "behaviour"
  | "patterns"
  | "tradeoffs"
  | "completeness";

export interface EvaluationIssue {
  severity: Severity;
  category: IssueCategory;
  /** What was detected, e.g. "ParkingLot directly constructs Tickets". */
  title: string;
  /** Why it matters, grounded in the learner's actual design. */
  explanation: string;
  /** How to improve — a direction, never "the only correct answer". */
  suggestion: string;
  /** Optional sketch of a better approach. */
  example?: string;
}

export interface EvaluationStrength {
  title: string;
  explanation: string;
}

export interface RequirementCoverage {
  requirementId: string;
  requirement: string;
  covered: boolean;
  explanation: string;
}

export interface DimensionScore {
  name: string;
  /** 0–100 */
  score: number;
  explanation: string;
}

export interface Suggestion {
  title: string;
  detail: string;
}

export interface DeterministicCheck {
  name: string;
  passed: boolean;
  detail: string;
}

export interface DeterministicReport {
  score: number;
  checks: DeterministicCheck[];
}

/** Where each finding came from — makes the evaluation explainable. */
export interface EvaluationSources {
  deterministic: DeterministicReport;
  llmContributed: boolean;
  llmModel?: string;
}

export interface EvaluationResult {
  /** 0–100 */
  overallScore: number;
  summary: string;
  strengths: EvaluationStrength[];
  issues: EvaluationIssue[];
  requirementCoverage: RequirementCoverage[];
  dimensions: DimensionScore[];
  suggestions: Suggestion[];
  sources: EvaluationSources;
}
