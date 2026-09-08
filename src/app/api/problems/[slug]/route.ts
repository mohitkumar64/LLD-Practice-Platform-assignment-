import { NextResponse } from "next/server";
import { getServices } from "@/lib/container";
import { errorResponse } from "@/api/errorResponse";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const { problems, attempts } = getServices();
    const problem = await problems.getProblem(slug);
    const history = await attempts.listAttempts(slug);
    return NextResponse.json({ problem, attempts: history });
  } catch (err) {
    return errorResponse(err);
  }
}
