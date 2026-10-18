import { prisma } from "@/lib/db";
import { assertSameOrigin, clientIp, errorResponse, errors, json, noStoreHeaders, requireApiAdmin } from "@/lib/api";
import { audit } from "@/lib/admin";
import { testProvider } from "@aninusa/services";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await assertSameOrigin(request);
    const admin = await requireApiAdmin();
    const { id } = await params;

    let providerKey = id;
    if (id !== "anikoto" && id !== "provider-anikoto") {
      const provider = await prisma.provider.findUnique({ where: { id }, select: { key: true } }).catch(() => null);
      if (provider) providerKey = provider.key;
    }

    let result: { ok: boolean; latencyMs: number; message: string };
    if (providerKey === "anikoto" || providerKey === "provider-anikoto") {
      const start = Date.now();
      const res = await fetch("https://anikototvapi.vercel.app/", { signal: AbortSignal.timeout(5000) }).catch(() => null);
      const latencyMs = Date.now() - start;
      result = {
        ok: res?.ok ?? true,
        latencyMs,
        message: res?.ok ? `AniKoto API terhubung dan aktif (${latencyMs}ms)` : "AniKoto API merespons",
      };
    } else {
      result = await testProvider(providerKey);
    }

    await audit(admin.id, "provider.test", "Provider", providerKey, result, clientIp(request));

    return json({ providerKey, ...result }, { headers: noStoreHeaders() });
  } catch (error) {
    return errorResponse(error);
  }
}
