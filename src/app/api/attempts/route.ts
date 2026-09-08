import { NextResponse } from "next/server";
import { getServices } from "@/lib/container";
import { errorResponse } from "@/api/errorResponse";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { attempts } = getServices();
    const problemSlug = new URL(request.url).searchParams.get("problemSlug") ?? undefined;
    const list = await attempts.listAttempts(problemSlug || undefined);
    return NextResponse.json({ attempts: list });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { problemSlug?: unknown };
    if (typeof body.problemSlug !== "string" || body.problemSlug.length === 0) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: "problemSlug is required." } },
        { status: 400 },
      );
    }
    const { attempts } = getServices();
    const attempt = await attempts.startAttempt(body.problemSlug);
    return NextResponse.json({ attempt }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
