import { adminUserUpdateSchema } from "@aninusa/types";
import { prisma } from "@/lib/db";
import {
  assertSameOrigin,
  clientIp,
  errorResponse,
  errors,
  json,
  noStoreHeaders,
  parseJson,
  requireApiAdmin,
} from "@/lib/api";
import { audit } from "@/lib/admin";

export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await assertSameOrigin(request);
    const admin = await requireApiAdmin();
    const { id } = await params;
    const input = await parseJson(request, adminUserUpdateSchema);

    const existing = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw errors.notFound("Pengguna tidak ditemukan");

    if (admin.role !== "ADMIN") throw errors.forbidden("Hanya admin dapat mengubah pengguna");
    if (admin.id === id && input.role && input.role !== "ADMIN") {
      throw errors.badRequest("Anda tidak dapat menurunkan peran akun sendiri");
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(input.role ? { role: input.role } : {}),
        ...(input.username ? { username: input.username } : {}),
        ...(input.email ? { email: input.email } : {}),
      },
      select: { id: true, username: true, email: true, role: true },
    });

    await audit(admin.id, "user.update", "User", id, { role: user.role }, clientIp(request));
    return json(user, { headers: noStoreHeaders() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await assertSameOrigin(request);
    const admin = await requireApiAdmin();
    const { id } = await params;

    if (admin.role !== "ADMIN") throw errors.forbidden("Hanya admin dapat menghapus pengguna");
    if (admin.id === id) throw errors.badRequest("Anda tidak dapat menghapus akun sendiri");

    const existing = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw errors.notFound("Pengguna tidak ditemukan");

    await prisma.user.delete({ where: { id } });
    await audit(admin.id, "user.delete", "User", id, {}, clientIp(request));

    return json({ ok: true }, { headers: noStoreHeaders() });
  } catch (error) {
    return errorResponse(error);
  }
}
