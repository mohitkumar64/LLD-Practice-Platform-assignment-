import { NextResponse } from "next/server";
import { getServices } from "@/lib/container";
import { errorResponse } from "@/api/errorResponse";

export const dynamic = "force-dynamic";

/**
 * Evaluation status endpoint. Returns the attempt with its evaluation (when
 * EVALUATED), failure reason (when FAILED), or plain status while EVALUATING.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { attempts } = getServices();
    const attempt = await attempts.getAttempt(id);
    return NextResponse.json({
      status: attempt.status,
      failureReason: attempt.failureReason,
      evaluation: attempt.evaluation,
    });
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * Retry evaluation after a failure. Returns 202 immediately with the attempt
 * in EVALUATING — identical semantics to submit — so no HTTP request blocks
 * for the duration of an LLM call. The client polls the GET endpoint.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { evaluation } = getServices();
    const attempt = await evaluation.requestEvaluation(id);
    return NextResponse.json({ attempt }, { status: 202 });
  } catch (err) {
    return errorResponse(err);
  }
}
