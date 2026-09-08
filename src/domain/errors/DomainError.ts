/** Error codes are stable strings the API layer maps to HTTP responses. */
export type DomainErrorCode =
  | "PROBLEM_NOT_FOUND"
  | "ATTEMPT_NOT_FOUND"
  | "ATTEMPT_ALREADY_SUBMITTED"
  | "INVALID_SUBMISSION"
  | "EVALUATION_NOT_POSSIBLE"
  | "EVALUATION_FAILED"
  | "AI_PROVIDER_UNAVAILABLE";

export class DomainError extends Error {
  constructor(
    public readonly code: DomainErrorCode,
    message: string,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export class ProblemNotFoundError extends DomainError {
  constructor(slug: string) {
    super("PROBLEM_NOT_FOUND", `No problem found for "${slug}".`, { slug });
  }
}

export class AttemptNotFoundError extends DomainError {
  constructor(attemptId: string) {
    super("ATTEMPT_NOT_FOUND", `No attempt found for id "${attemptId}".`, { attemptId });
  }
}

export class AttemptAlreadySubmittedError extends DomainError {
  constructor(attemptId: string) {
    super(
      "ATTEMPT_ALREADY_SUBMITTED",
      "This attempt has already been submitted. Start a new attempt to iterate.",
      { attemptId },
    );
  }
}

export interface SubmissionIssue {
  field: string;
  message: string;
}

export class InvalidSubmissionError extends DomainError {
  constructor(issues: SubmissionIssue[]) {
    super("INVALID_SUBMISSION", "The submission is not a valid structured design.", { issues });
  }
}

export class EvaluationNotPossibleError extends DomainError {
  constructor(attemptId: string, status: string) {
    super(
      "EVALUATION_NOT_POSSIBLE",
      `Attempt is in status ${status}; only a submitted attempt can be evaluated.`,
      { attemptId, status },
    );
  }
}

export class EvaluationFailedError extends DomainError {
  constructor(reason: string) {
    super("EVALUATION_FAILED", `Evaluation failed: ${reason}`, { reason });
  }
}

export class AIProviderUnavailableError extends EvaluationFailedError {
  constructor(reason: string) {
    super(`AI provider unavailable — ${reason}`);
    this.name = "AIProviderUnavailableError";
  }
}
