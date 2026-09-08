import { AttemptAlreadySubmittedError, EvaluationNotPossibleError } from "../errors/DomainError";
import type { StructuredDesignSubmission } from "../submission/StructuredDesignSubmission";
import type { Evaluator } from "../evaluation/Evaluator";
import type { EvaluationResult } from "../evaluation/EvaluationResult";

export type AttemptStatus = "DRAFT" | "SUBMITTED" | "EVALUATING" | "EVALUATED" | "FAILED";

export interface AttemptSnapshot {
  id: string;
  problemSlug: string;
  attemptNumber: number;
  status: AttemptStatus;
  createdAt: string;
  submittedAt: string | null;
  evaluatedAt: string | null;
  submission: StructuredDesignSubmission | null;
  evaluation: EvaluationResult | null;
  failureReason: string | null;
}

/**
 * Attempt — one practice round against a problem.
 *
 * This is the heart of the lifecycle invariant set:
 *
 *   DRAFT → SUBMITTED → EVALUATING → EVALUATED
 *                             └────→ FAILED → (retry) → EVALUATING
 *
 * Invariants enforced here (not in the UI, not in the API):
 *  - a DRAFT attempt has no submission; a submitted attempt's submission is
 *    immutable (iteration means a NEW attempt, not rewriting history);
 *  - submit() rejects an empty/structurally invalid submission;
 *  - only SUBMITTED (or FAILED, on retry) attempts may enter EVALUATING;
 *  - only an EVALUATING attempt may complete or fail evaluation;
 *  - terminal state is EVALUATED — a re-evaluation of an EVALUATED attempt
 *    is a domain error, so scores can never silently change.
 */
export class Attempt {
  private constructor(
    public readonly id: string,
    public readonly problemSlug: string,
    public readonly attemptNumber: number,
    private status: AttemptStatus,
    private readonly createdAt: string,
    private submittedAt: string | null = null,
    private evaluatedAt: string | null = null,
    private submission: StructuredDesignSubmission | null = null,
    private evaluation: EvaluationResult | null = null,
    private failureReason: string | null = null,
  ) {}

  static start(id: string, problemSlug: string, attemptNumber: number, now: Date): Attempt {
    if (attemptNumber < 1) {
      throw new Error("attemptNumber must be >= 1");
    }
    return new Attempt(id, problemSlug, attemptNumber, "DRAFT", now.toISOString());
  }

  static rehydrate(snapshot: AttemptSnapshot): Attempt {
    return new Attempt(
      snapshot.id,
      snapshot.problemSlug,
      snapshot.attemptNumber,
      snapshot.status,
      snapshot.createdAt,
      snapshot.submittedAt,
      snapshot.evaluatedAt,
      snapshot.submission,
      snapshot.evaluation,
      snapshot.failureReason,
    );
  }

  getAttemptStatus(): AttemptStatus {
    return this.status;
  }

  getSubmission(): StructuredDesignSubmission | null {
    return this.submission;
  }

  getEvaluation(): EvaluationResult | null {
    return this.evaluation;
  }

  getFailureReason(): string | null {
    return this.failureReason;
  }

  getSubmittedAt(): string | null {
    return this.submittedAt;
  }

  getEvaluatedAt(): string | null {
    return this.evaluatedAt;
  }

  getCreatedAt(): string {
    return this.createdAt;
  }

  submit(submission: StructuredDesignSubmission, validate: (s: StructuredDesignSubmission) => void, now: Date): void {
    if (this.status !== "DRAFT") {
      throw new AttemptAlreadySubmittedError(this.id);
    }
    validate(submission); // throws InvalidSubmissionError with per-field issues
    this.submission = submission;
    this.status = "SUBMITTED";
    this.submittedAt = now.toISOString();
  }

  beginEvaluation(now: Date): void {
    // SUBMITTED: normal start. EVALUATING: crash recovery — if the process
    // died mid-evaluation the attempt would otherwise be stuck forever.
    // Re-beginning is safe: completion/failure are only legal from
    // EVALUATING, and the in-flight guard serialises concurrent retries.
    // FAILED: explicit user retry.
    if (
      this.status !== "SUBMITTED" &&
      this.status !== "FAILED" &&
      this.status !== "EVALUATING"
    ) {
      throw new EvaluationNotPossibleError(this.id, this.status);
    }
    if (this.submission === null) {
      throw new EvaluationNotPossibleError(this.id, this.status);
    }
    this.status = "EVALUATING";
    this.failureReason = null;
    this.evaluatedAt = null;
    void now;
  }

  completeEvaluation(result: EvaluationResult, now: Date): void {
    if (this.status !== "EVALUATING") {
      throw new EvaluationNotPossibleError(this.id, this.status);
    }
    this.evaluation = result;
    this.evaluatedAt = now.toISOString();
    this.status = "EVALUATED";
  }

  failEvaluation(reason: string): void {
    if (this.status !== "EVALUATING") {
      throw new EvaluationNotPossibleError(this.id, this.status);
    }
    this.failureReason = reason;
    this.status = "FAILED";
  }

  toSnapshot(): AttemptSnapshot {
    return {
      id: this.id,
      problemSlug: this.problemSlug,
      attemptNumber: this.attemptNumber,
      status: this.status,
      createdAt: this.createdAt,
      submittedAt: this.submittedAt,
      evaluatedAt: this.evaluatedAt,
      submission: this.submission,
      evaluation: this.evaluation,
      failureReason: this.failureReason,
    };
  }
}
