import { NextResponse } from "next/server";
import { getServices } from "@/lib/container";
import { errorResponse } from "@/api/errorResponse";

export const dynamic = "force-dynamic";

/**
 * Submit a structured design. Response returns immediately with the attempt
 * in EVALUATING; the client polls /attempts/:id/evaluation for the outcome.
 * Structurally invalid submissions are rejected with 400 and per-field
 * issues, and the attempt stays DRAFT.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const payload = (await request.json()) as Record<string, unknown>;
    const { attempts, evaluation } = getServices();

    const submitted = await attempts.submitAttempt(id, payload);
    const evaluating = await evaluation.requestEvaluation(id);
    return NextResponse.json({ attempt: evaluating ?? submitted }, { status: 202 });
  } catch (err) {
    return errorResponse(err);
  }
}
