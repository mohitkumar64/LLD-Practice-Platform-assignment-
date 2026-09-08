/**
 * Problem — the exercise a learner practices against.
 *
 * A Problem owns the *requirements surface* the learner designs against.
 * It deliberately does NOT contain a reference solution: LLD has many valid
 * answers, and grading against a single canonical design is exactly the
 * anti-pattern this platform avoids. Evaluation hints live in
 * `requirements[].keywords` (deterministic coverage) and in the evaluator
 * prompt (reasoning), not in a "correct class diagram".
 */

import type { AttemptStatus } from "../attempt/Attempt";

export type Difficulty = "Easy" | "Medium" | "Hard";

export interface ProblemRequirement {
  id: string;
  description: string;
  /** Lowercase keyword hints used by the deterministic coverage check. */
  keywords: string[];
}

export interface Problem {
  slug: string;
  title: string;
  difficulty: Difficulty;
  summary: string;
  estimatedMinutes: number;
  /** Markdown problem statement. */
  statement: string;
  requirements: ProblemRequirement[];
  assumptions: string[];
  designConsiderations: string[];
}

export interface ProblemWithProgress extends Problem {
  attemptCount: number;
  bestScore: number | null;
  lastAttemptStatus: AttemptStatus | null;
}
