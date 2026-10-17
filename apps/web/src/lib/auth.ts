import "server-only";

import { cache as unstableCache } from "react";
import { cookies, headers } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@aninusa/types";
import { prisma } from "./db";
import { serverEnv } from "./env";
import { hashPassword, verifyPassword } from "./password";

export { hashPassword, verifyPassword };

const ISSUER = "aninusa";
const AUDIENCE = "aninusa-web";

export interface SessionUser {
  id: string;
  username: string;
  email: string;
  avatar: string | null;
  role: Role;
  sessionId: string;
}

function secretKey(): Uint8Array {
  return new TextEncoder().encode(serverEnv().AUTH_SECRET);
}

export function cookieOptions(maxAgeSeconds: number) {
  // Secure cookies require HTTPS. Production is HTTPS by default; local
  // production-mode smoke tests over plain HTTP can set COOKIE_SECURE=false.
  const secure =
    process.env.COOKIE_SECURE === "false" ? false : process.env.NODE_ENV === "production";

  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export async function createSession(
  userId: string,
  metadata: { userAgent?: string | null; ip?: string | null } = {},
): Promise<{ token: string; maxAge: number }> {
  const env = serverEnv();
  const maxAge = env.SESSION_TTL_DAYS * 24 * 60 * 60;
  const expiresAt = new Date(Date.now() + maxAge * 1000);

  const session = await prisma.session.create({
    data: {
      userId,
      expiresAt,
      userAgent: metadata.userAgent?.slice(0, 500) ?? null,
      ip: metadata.ip?.slice(0, 100) ?? null,
    },
    select: { id: true, user: { select: { role: true } } },
  });

  const token = await new SignJWT({
    sid: session.id,
    uid: userId,
    role: session.user.role,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(secretKey());

  return { token, maxAge };
}

export async function destroySession(sessionId: string): Promise<void> {
  await prisma.session
    .update({ where: { id: sessionId }, data: { revokedAt: new Date() } })
    .catch(() => undefined);
}

async function readSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(serverEnv().SESSION_COOKIE_NAME)?.value ?? null;
}

async function resolveSession(token: string | null): Promise<SessionUser | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      issuer: ISSUER,
      audience: AUDIENCE,
      clockTolerance: 30,
    });

    const sessionId = typeof payload.sid === "string" ? payload.sid : null;
    const userId = typeof payload.uid === "string" ? payload.uid : null;
    if (!sessionId || !userId) return null;

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        revokedAt: true,
        expiresAt: true,
        userId: true,
        user: {
          select: { id: true, username: true, email: true, avatar: true, role: true },
        },
      },
    });

    if (!session || session.revokedAt || session.expiresAt <= new Date()) return null;
    if (session.userId !== userId) return null;

    return {
      id: session.user.id,
      username: session.user.username,
      email: session.user.email,
      avatar: session.user.avatar,
      role: session.user.role as Role,
      sessionId: session.id,
    };
  } catch {
    return null;
  }
}

/**
 * Per-request memoized session lookup. React `cache` dedupes the database call
 * across layouts, pages and metadata generation within one render pass.
 */
export const getSessionUser = unstableCache(async (): Promise<SessionUser | null> => {
  const token = await readSessionToken();
  return resolveSession(token);
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthError("UNAUTHORIZED");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN" && user.role !== "MODERATOR") throw new AuthError("FORBIDDEN");
  return user;
}

export class AuthError extends Error {
  readonly code: "UNAUTHORIZED" | "FORBIDDEN";

  constructor(code: "UNAUTHORIZED" | "FORBIDDEN") {
    super(code);
    this.name = "AuthError";
    this.code = code;
  }
}

export async function requestMetadata(): Promise<{ userAgent: string | null; ip: string | null }> {
  const headerStore = await headers();
  const forwarded = headerStore.get("x-forwarded-for");
  return {
    userAgent: headerStore.get("user-agent"),
    ip: forwarded?.split(",")[0]?.trim() ?? headerStore.get("x-real-ip"),
  };
}

export function isAdminRole(role: Role | undefined): boolean {
  return role === "ADMIN" || role === "MODERATOR";
}
