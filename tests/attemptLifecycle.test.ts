import { describe, it, expect } from "vitest";
import { Attempt } from "@/domain/attempt/Attempt";
import { assertValidSubmission } from "@/domain/submission/SubmissionValidator";
import type { EvaluationResult } from "@/domain/evaluation/EvaluationResult";
import { DomainError } from "@/domain/errors/DomainError";
import { validSubmission } from "./helpers";

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

describe("attempt lifecycle (domain entity)", () => {
  it("moves DRAFT -> SUBMITTED -> EVALUATING -> EVALUATED", () => {
    const attempt = Attempt.start("a1", "parking-lot", 1, new Date("2026-09-08T10:00:00Z"));
    expect(attempt.getAttemptStatus()).toBe("DRAFT");

    attempt.submit(validSubmission(), assertValidSubmission, new Date("2026-09-08T10:05:00Z"));
    expect(attempt.getAttemptStatus()).toBe("SUBMITTED");
    expect(attempt.getSubmission()).not.toBeNull();

    attempt.beginEvaluation(new Date("2026-09-08T10:05:01Z"));
    expect(attempt.getAttemptStatus()).toBe("EVALUATING");

    attempt.completeEvaluation(makeResult(80), new Date("2026-09-08T10:06:00Z"));

    const snap = attempt.toSnapshot();
    expect(snap.status).toBe("EVALUATED");
    expect(snap.evaluation?.overallScore).toBe(80);
    expect(snap.evaluatedAt).toBe("2026-09-08T10:06:00.000Z");
  });

  it("rejects resubmission — a submitted attempt is immutable", () => {
    const attempt = Attempt.start("a1", "parking-lot", 1, new Date());
    attempt.submit(validSubmission(), assertValidSubmission, new Date());
    expect(() => attempt.submit(validSubmission(), assertValidSubmission, new Date())).toThrow(
      /already been submitted/,
    );
  });

  it("rejects an empty submission and stays in DRAFT", () => {
    const attempt = Attempt.start("a1", "parking-lot", 1, new Date());
    const empty = { entities: [], relationships: [], patterns: [], tradeoffs: [], pseudocode: null };
    try {
      attempt.submit(empty, assertValidSubmission, new Date());
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      const issues = (err as DomainError).details.issues as { field: string; message: string }[];
      expect(issues.some((i) => i.field === "entities" && i.message.includes("at least one class"))).toBe(true);
    }
    expect(attempt.getAttemptStatus()).toBe("DRAFT");
    expect(attempt.getSubmission()).toBeNull();
  });

  it("refuses to evaluate a DRAFT attempt", () => {
    const attempt = Attempt.start("a1", "parking-lot", 1, new Date());
    expect(() => attempt.beginEvaluation(new Date())).toThrow(DomainError);
  });

  it("FAILED attempts record the reason and can re-enter evaluation", () => {
    const attempt = Attempt.start("a1", "parking-lot", 1, new Date());
    attempt.submit(validSubmission(), assertValidSubmission, new Date());
    attempt.beginEvaluation(new Date());
    attempt.failEvaluation("AI provider unavailable");

    expect(attempt.getAttemptStatus()).toBe("FAILED");
    expect(attempt.getFailureReason()).toContain("AI provider");

    expect(() => attempt.beginEvaluation(new Date())).not.toThrow();
    attempt.completeEvaluation(makeResult(64), new Date());
    expect(attempt.getAttemptStatus()).toBe("EVALUATED");
    expect(attempt.getFailureReason()).toBeNull();
  });

  it("recovers an attempt stuck in EVALUATING (process crash mid-review)", () => {
    const attempt = Attempt.start("a1", "parking-lot", 1, new Date());
    attempt.submit(validSubmission(), assertValidSubmission, new Date());
    attempt.beginEvaluation(new Date());
    // simulate: the process died before completing/failing the evaluation
    expect(() => attempt.beginEvaluation(new Date())).not.toThrow();
    expect(attempt.getAttemptStatus()).toBe("EVALUATING");
    attempt.completeEvaluation(makeResult(72), new Date());
    expect(attempt.getAttemptStatus()).toBe("EVALUATED");
  });

  it("an EVALUATED attempt can never be re-scored", () => {
    const attempt = Attempt.start("a1", "parking-lot", 1, new Date());
    attempt.submit(validSubmission(), assertValidSubmission, new Date());
    attempt.beginEvaluation(new Date());
    attempt.completeEvaluation(makeResult(50), new Date());

    expect(() => attempt.beginEvaluation(new Date())).toThrow(DomainError);
    expect(() => attempt.completeEvaluation(makeResult(99), new Date())).toThrow(DomainError);
    expect(attempt.getEvaluation()?.overallScore).toBe(50);
  });

  it("round-trips through rehydrate (persistence boundary)", () => {
    const attempt = Attempt.start("a2", "parking-lot", 2, new Date());
    attempt.submit(validSubmission(), assertValidSubmission, new Date());
    const revived = Attempt.rehydrate(attempt.toSnapshot());
    expect(revived.getAttemptStatus()).toBe("SUBMITTED");
    expect(revived.getSubmission()).toEqual(validSubmission());
  });
});
