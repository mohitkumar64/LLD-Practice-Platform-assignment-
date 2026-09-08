import { NextResponse } from "next/server";
import { getServices } from "@/lib/container";
import { errorResponse } from "@/api/errorResponse";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { problems } = getServices();
    const list = await problems.listProblemsWithProgress();
    return NextResponse.json({ problems: list });
  } catch (err) {
    return errorResponse(err);
  }
}
