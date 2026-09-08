import { NextResponse } from "next/server";
import { getServices } from "@/lib/container";
import { errorResponse } from "@/api/errorResponse";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { attempts } = getServices();
    const attempt = await attempts.getAttempt(id);
    return NextResponse.json({ attempt });
  } catch (err) {
    return errorResponse(err);
  }
}
