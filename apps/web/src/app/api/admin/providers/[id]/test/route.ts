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

    const provider = await prisma.provider.findUnique({ where: { id }, select: { key: true } });
    if (!provider) throw errors.notFound("Provider tidak ditemukan");

    const result = await testProvider(provider.key);
    await audit(admin.id, "provider.test", "Provider", provider.key, result, clientIp(request));

    return json({ providerKey: provider.key, ...result }, { headers: noStoreHeaders() });
  } catch (error) {
    return errorResponse(error);
  }
}
