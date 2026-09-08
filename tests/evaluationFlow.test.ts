import { describe, it, expect } from "vitest";
import type { RawSubmissionPayload } from "@/domain/submission/StructuredDesignSubmission";
import type { Evaluator } from "@/domain/evaluation/Evaluator";
import type { EvaluationResult } from "@/domain/evaluation/EvaluationResult";
import { AttemptService } from "@/application/AttemptService";
import { EvaluationService } from "@/application/EvaluationService";
import { InMemoryAttemptRepository, TEST_PROBLEM, validSubmission } from "./helpers";

const problems = {
  list: async () => [TEST_PROBLEM],
  findBySlug: async () => TEST_PROBLEM,
};

function makeResult(score: number): EvaluationResult {
  return {
    overallScore: score,
    summary: "synthetic",
    strengths: [],
    issues: [],
    requirementCoverage: [],
    dimensions: [],
    suggestions: [],
    sources: { deterministic: { score, checks: [] }, llmContributed: false },
  };
}

const constantEvaluator: Evaluator = { evaluate: async () => makeResult(90) };
const failingEvaluator: Evaluator = {
  evaluate: async () => {
    throw new Error("model timeout");
  },
};

describe("attempt + evaluation services (evaluator substituted via interface)", () => {
  it("runs the full loop: start -> submit -> evaluate -> EVALUATED", async () => {
    const attempts = new InMemoryAttemptRepository();
    const attemptService = new AttemptService(attempts, problems);
    const evaluationService = new EvaluationService(attempts, problems, constantEvaluator);

    const attempt = await attemptService.startAttempt("parking-lot");
    expect(attempt.status).toBe("DRAFT");

    const submitted = await attemptService.submitAttempt(
      attempt.id,
      validSubmission() as unknown as RawSubmissionPayload,
    );
    expect(submitted.status).toBe("SUBMITTED");

    const evaluated = await evaluationService.evaluateNow(attempt.id);
    expect(evaluated.status).toBe("EVALUATED");
    expect(evaluated.evaluation?.overallScore).toBe(90);
  });

  it("records FAILED with a readable reason when the evaluator throws — and a retry succeeds", async () => {
    const attempts = new InMemoryAttemptRepository();
    const attemptService = new AttemptService(attempts, problems);
    const flaky = new EvaluationService(attempts, problems, failingEvaluator);
    const healthy = new EvaluationService(attempts, problems, constantEvaluator);

    const attempt = await attemptService.startAttempt("parking-lot");
    await attemptService.submitAttempt(attempt.id, validSubmission() as unknown as RawSubmissionPayload);

    const failed = await flaky.evaluateNow(attempt.id);
    expect(failed.status).toBe("FAILED");
    expect(failed.failureReason).toBe("model timeout");

    const retried = await healthy.evaluateNow(attempt.id);
    expect(retried.status).toBe("EVALUATED");
    expect(retried.failureReason).toBeNull();
  });

  it("requestEvaluation returns immediately with EVALUATING and still completes", async () => {
    const attempts = new InMemoryAttemptRepository();
    const attemptService = new AttemptService(attempts, problems);
    const evaluationService = new EvaluationService(attempts, problems, constantEvaluator);

    const attempt = await attemptService.startAttempt("parking-lot");
    await attemptService.submitAttempt(attempt.id, validSubmission() as unknown as RawSubmissionPayload);

    const snapshot = await evaluationService.requestEvaluation(attempt.id);
    expect(snapshot.status).toBe("EVALUATING");

    // The in-flight work completes and persists EVALUATED.
    await new Promise((r) => setTimeout(r, 20));
    const stored = await attempts.findById(attempt.id);
    expect(stored?.status).toBe("EVALUATED");
  });

  it("preserves the full history of attempts per problem", async () => {
    const attempts = new InMemoryAttemptRepository();
    const attemptService = new AttemptService(attempts, problems);

    await attemptService.startAttempt("parking-lot");
    const second = await attemptService.startAttempt("parking-lot");
    await attemptService.startAttempt("parking-lot");

    expect(second.attemptNumber).toBe(2);
    const history = await attemptService.listAttempts("parking-lot");
    expect(history).toHaveLength(3);
    expect(history.map((a) => a.attemptNumber).sort()).toEqual([1, 2, 3]);
  });

  it("maps an unknown problem to a domain error", async () => {
    const attemptService = new AttemptService(new InMemoryAttemptRepository(), {
      list: async () => [],
      findBySlug: async () => null,
    });
    await expect(attemptService.startAttempt("nope")).rejects.toThrow(/No problem found/);
  });
});
