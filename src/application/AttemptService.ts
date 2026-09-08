import { randomUUID } from "node:crypto";
import { Attempt } from "@/domain/attempt/Attempt";
import type { AttemptSnapshot } from "@/domain/attempt/Attempt";
import type { AttemptRepository } from "@/domain/attempt/AttemptRepository";
import type { ProblemRepository } from "@/domain/problem/ProblemRepository";
import type { RawSubmissionPayload } from "@/domain/submission/StructuredDesignSubmission";
import {
  assertValidSubmission,
  normalizeSubmission,
} from "@/domain/submission/SubmissionValidator";
import {
  AttemptNotFoundError,
  ProblemNotFoundError,
} from "@/domain/errors/DomainError";

export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

/**
 * AttemptService — use cases of the practice loop that do NOT involve the
 * evaluator: starting, reading, listing, and submitting attempts.
 *
 * Submission validation is delegated to the domain (Attempt.submit calls the
 * injected validator), so an invalid payload can never enter persistence.
 */
export class AttemptService {
  constructor(
    private readonly attempts: AttemptRepository,
    private readonly problems: ProblemRepository,
    private readonly clock: Clock = systemClock,
    private readonly newId: () => string = () => randomUUID(),
  ) {}

  async startAttempt(problemSlug: string): Promise<AttemptSnapshot> {
    const problem = await this.problems.findBySlug(problemSlug);
    if (!problem) throw new ProblemNotFoundError(problemSlug);

    const existing = await this.attempts.listByProblem(problemSlug);
    const attempt = Attempt.start(
      this.newId(),
      problemSlug,
      existing.length + 1,
      this.clock.now(),
    );
    const snapshot = attempt.toSnapshot();
    await this.attempts.save(snapshot);
    return snapshot;
  }

  async getAttempt(id: string): Promise<AttemptSnapshot> {
    return this.load(id);
  }

  async listAttempts(problemSlug?: string): Promise<AttemptSnapshot[]> {
    const list = problemSlug
      ? await this.attempts.listByProblem(problemSlug)
      : await this.attempts.listAll();
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /** Returns the previous attempt snapshot for improvement comparison. */
  async submitAttempt(id: string, payload: RawSubmissionPayload): Promise<AttemptSnapshot> {
    const attempt = await this.loadEntity(id);
    const submission = normalizeSubmission(payload);
    attempt.submit(submission, assertValidSubmission, this.clock.now());
    const snapshot = attempt.toSnapshot();
    await this.attempts.save(snapshot);
    return snapshot;
  }

  private async load(id: string): Promise<AttemptSnapshot> {
    const snapshot = await this.attempts.findById(id);
    if (!snapshot) throw new AttemptNotFoundError(id);
    return snapshot;
  }

  private async loadEntity(id: string): Promise<Attempt> {
    const snapshot = await this.load(id);
    return Attempt.rehydrate(snapshot);
  }
}
