import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cache } from "@/lib/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  const checks: Record<string, "ok" | "error"> = {};

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = "ok";
  } catch {
    checks.database = "error";
  }

  try {
    await cache().set("health:ping", "pong", 10);
    const value = await cache().get<string>("health:ping");
    checks.cache = value === "pong" ? "ok" : "error";
  } catch {
    checks.cache = "error";
  }

  const healthy = Object.values(checks).every((status) => status === "ok");

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      checks,
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    },
    {
      status: healthy ? 200 : 503,
      headers: { "cache-control": "no-store" },
    },
  );
}
