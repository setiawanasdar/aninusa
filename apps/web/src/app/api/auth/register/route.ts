import { cookies } from "next/headers";
import { registerSchema } from "@aninusa/types";
import { prisma } from "@/lib/db";
import {
  assertSameOrigin,
  enforceRateLimit,
  errorResponse,
  errors,
  json,
  noStoreHeaders,
  parseJson,
} from "@/lib/api";
import {
  cookieOptions,
  createSession,
  hashPassword,
  requestMetadata,
} from "@/lib/auth";
import { serverEnv } from "@/lib/env";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await assertSameOrigin(request);
    await enforceRateLimit(request, "auth");

    const input = await parseJson(request, registerSchema);

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: input.email }, { username: input.username }] },
      select: { id: true, email: true },
    });
    if (existing) {
      throw errors.conflict(
        existing.email === input.email ? "Email sudah terdaftar" : "Username sudah digunakan",
      );
    }

    const passwordHash = await hashPassword(input.password);
    const user = await prisma.user.create({
      data: {
        email: input.email,
        username: input.username,
        passwordHash,
      },
      select: { id: true, username: true, email: true, avatar: true, role: true, createdAt: true },
    });

    const meta = await requestMetadata();
    const { token, maxAge } = await createSession(user.id, meta);
    const cookieStore = await cookies();
    cookieStore.set(serverEnv().SESSION_COOKIE_NAME, token, cookieOptions(maxAge));

    return json(
      {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
      },
      { status: 201, headers: noStoreHeaders() },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
