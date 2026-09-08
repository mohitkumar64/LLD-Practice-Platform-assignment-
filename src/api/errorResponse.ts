import { NextResponse } from "next/server";
import { DomainError } from "@/domain/errors/DomainError";

const STATUS_BY_CODE: Record<string, number> = {
  PROBLEM_NOT_FOUND: 404,
  ATTEMPT_NOT_FOUND: 404,
  ATTEMPT_ALREADY_SUBMITTED: 409,
  INVALID_SUBMISSION: 400,
  EVALUATION_NOT_POSSIBLE: 409,
  EVALUATION_FAILED: 502,
  AI_PROVIDER_UNAVAILABLE: 502,
};

/**
 * Single place where domain errors become HTTP responses. Route handlers
 * stay thin; users get structured errors, never stack traces.
 */
export function errorResponse(err: unknown): NextResponse {
  if (err instanceof DomainError) {
    const status = STATUS_BY_CODE[err.code] ?? 500;
    return NextResponse.json(
      { error: { code: err.code, message: err.message, details: err.details } },
      { status },
    );
  }
  const message =
    err instanceof Error ? err.message : "An unexpected error occurred.";
  console.error("[api] unhandled error:", err);
  return NextResponse.json(
    { error: { code: "INTERNAL", message } },
    { status: 500 },
  );
}
