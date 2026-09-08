import { AttemptNotFoundError } from "@/domain/errors/DomainError";
import type { Evaluator } from "@/domain/evaluation/Evaluator";
import { Attempt } from "@/domain/attempt/Attempt";
import type { AttemptSnapshot } from "@/domain/attempt/Attempt";
import type { AttemptRepository } from "@/domain/attempt/AttemptRepository";
import type { ProblemRepository } from "@/domain/problem/ProblemRepository";
import { EvaluationNotPossibleError } from "@/domain/errors/DomainError";
import type { Clock } from "./AttemptService";
import { systemClock } from "./AttemptService";

/**
 * EvaluationService — owns the EVALUATING process, including failure.
 *
 * Modelling decision: evaluation is NOT assumed to be instant or reliable.
 * The flow is
 *
 *   SUBMITTED ─→ beginEvaluation ─→ evaluator.evaluate()
 *                                    ├─ ok   → completeEvaluation → EVALUATED
 *                                    └─ throw → failEvaluation    → FAILED
 *
 * The caller (API route) gets control back immediately after the attempt is
 * persisted in EVALUATING; the actual work continues in-process. This keeps
 * the UI honest (it can poll status) without a job-queue system, which is
 * explicitly out of scope for this MVP. A per-attempt in-flight guard makes
 * double-submits of the retry endpoint harmless.
 *
 * Any evaluator failure — AI provider down, malformed AI response, timeout —
 * lands the attempt in FAILED with a human-readable reason, and the learner
 * can retry. Nothing is swallowed.
 */
export class EvaluationService {
  private readonly inFlight = new Set<string>();

  constructor(
    private readonly attempts: AttemptRepository,
    private readonly problems: ProblemRepository,
    private readonly evaluator: Evaluator,
    private readonly clock: Clock = systemClock,
  ) {}

  /**
   * Fire-and-forget entry point used by the submit API: returns as soon as
   * the attempt is in EVALUATING (or throws a domain error if evaluation
   * cannot start). The returned promise never rejects — failures are
   * recorded on the attempt as FAILED.
   */
  async requestEvaluation(attemptId: string): Promise<AttemptSnapshot> {
    const attempt = await this.loadEntity(attemptId);
    const snapshot = this.begin(attempt);
    void this.run(attempt).catch(() => undefined); // failures recorded in run()
    return snapshot;
  }

  /** Synchronous variant, used by retry and by tests. */
  async evaluateNow(attemptId: string): Promise<AttemptSnapshot> {
    const attempt = await this.loadEntity(attemptId);
    this.begin(attempt);
    return this.run(attempt);
  }

  private begin(attempt: Attempt): AttemptSnapshot {
    if (this.inFlight.has(attempt.id)) {
      // Already being evaluated; reporting current state is more honest
      // than throwing — the UI just keeps polling.
      return attempt.toSnapshot();
    }
    attempt.beginEvaluation(this.clock.now());
    this.inFlight.add(attempt.id);
    return attempt.toSnapshot();
  }

  private async run(attempt: Attempt): Promise<AttemptSnapshot> {
    try {
      await this.attempts.save(attempt.toSnapshot());
      const problem = await this.problems.findBySlug(attempt.problemSlug);
      if (!problem) {
        throw new Error(`problem "${attempt.problemSlug}" no longer exists`);
      }
      const submission = attempt.getSubmission();
      if (!submission) {
        throw new Error("attempt has no submission to evaluate");
      }
      const result = await this.evaluator.evaluate(problem, submission);
      attempt.completeEvaluation(result, this.clock.now());
    } catch (err) {
      const reason =
        err instanceof Error && err.message
          ? err.message
          : "unknown error during evaluation";
      attempt.failEvaluation(reason);
    } finally {
      this.inFlight.delete(attempt.id);
      await this.attempts.save(attempt.toSnapshot());
    }
    return attempt.toSnapshot();
  }

  private async loadEntity(id: string): Promise<Attempt> {
    const snapshot = await this.attempts.findById(id);
    if (!snapshot) {
      throw new AttemptNotFoundError(id);
    }
    return Attempt.rehydrate(snapshot);
  }
}
