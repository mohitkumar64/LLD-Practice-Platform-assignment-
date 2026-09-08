import { NextResponse } from "next/server";
import { getServices } from "@/lib/container";

export const dynamic = "force-dynamic";

export async function GET() {
  const services = getServices();
  return NextResponse.json({
    status: "ok",
    databaseConfigured: services.databaseConfigured,
    llmConfigured: services.llmConfigured,
  });
}
