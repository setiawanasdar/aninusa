import "server-only";

import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ERROR_CODES, type ErrorCode } from "@aninusa/types";
import { createLogger, getErrorMessage } from "@aninusa/utils";
import { AuthError, getSessionUser, type SessionUser } from "./auth";
import { cache } from "./cache";
import { siteUrl } from "./env";

const logger = createLogger({ service: "api" });

export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(status: number, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const errors = {
  badRequest: (message = "Permintaan tidak valid", details?: unknown) =>
    new ApiError(400, ERROR_CODES.BAD_REQUEST, message, details),
  unauthorized: (message = "Silakan masuk terlebih dahulu") =>
    new ApiError(401, ERROR_CODES.UNAUTHORIZED, message),
  forbidden: (message = "Anda tidak memiliki akses") =>
    new ApiError(403, ERROR_CODES.FORBIDDEN, message),
  notFound: (message = "Data tidak ditemukan") =>
    new ApiError(404, ERROR_CODES.NOT_FOUND, message),
  conflict: (message = "Data sudah ada") => new ApiError(409, ERROR_CODES.CONFLICT, message),
  rateLimited: (message = "Terlalu banyak permintaan. Coba lagi nanti.") =>
    new ApiError(429, ERROR_CODES.RATE_LIMITED, message),
  internal: (message = "Terjadi kesalahan pada server") =>
    new ApiError(500, ERROR_CODES.INTERNAL_ERROR, message),
};

export function json<T>(data: T, init: ResponseInit = {}): NextResponse {
  return NextResponse.json({ data }, init);
}

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, details: error.details } },
      { status: error.status },
    );
  }

  if (error instanceof AuthError) {
    return error.code === "UNAUTHORIZED"
      ? NextResponse.json(
          { error: { code: ERROR_CODES.UNAUTHORIZED, message: "Silakan masuk terlebih dahulu" } },
          { status: 401 },
        )
      : NextResponse.json(
          { error: { code: ERROR_CODES.FORBIDDEN, message: "Anda tidak memiliki akses" } },
          { status: 403 },
        );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: "Data tidak valid",
          details: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
      },
      { status: 400 },
    );
  }

  logger.error("Unhandled API error", { error: getErrorMessage(error) });
  return NextResponse.json(
    { error: { code: ERROR_CODES.INTERNAL_ERROR, message: "Terjadi kesalahan pada server" } },
    { status: 500 },
  );
}

/**
 * Same-origin check for state-changing requests. Combined with SameSite=Lax
 * cookies this blocks cross-site form/fetch CSRF without needing a token
 * round-trip. Requests without an Origin header (curl, server-to-server) are
 * allowed only when they are not cookie-authenticated mutations.
 */
export async function assertSameOrigin(request: Request): Promise<void> {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return;

  const origin = request.headers.get("origin");
  if (!origin) {
    const cookieName = process.env.SESSION_COOKIE_NAME ?? "aninusa_session";
    const hasCookie = Boolean(request.headers.get("cookie")?.includes(`${cookieName}=`));
    if (hasCookie) throw errors.forbidden("Permintaan lintas situs ditolak");
    return;
  }

  const allowed = new Set([siteUrl()]);
  const host = request.headers.get("host");
  if (host) {
    allowed.add(`http://${host}`);
    allowed.add(`https://${host}`);
  }

  // Trust the reverse proxy's forwarded host when present. A cross-site
  // attacker cannot set this header without a CORS preflight, which the app
  // never approves.
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost) {
    const proto = request.headers.get("x-forwarded-proto") ?? "https";
    allowed.add(`${proto}://${forwardedHost}`);
  }

  if (!allowed.has(origin)) {
    throw errors.forbidden("Origin tidak diizinkan");
  }
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return (
    forwarded?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    request.headers.get("cf-connecting-ip") ??
    "anonymous"
  );
}

type LimiterName = "public" | "auth" | "progress" | "admin";

const LIMITS: Record<LimiterName, { envKey: string; fallback: number }> = {
  public: { envKey: "RATE_LIMIT_PUBLIC_PER_MINUTE", fallback: 120 },
  auth: { envKey: "RATE_LIMIT_AUTH_PER_MINUTE", fallback: 10 },
  progress: { envKey: "RATE_LIMIT_PROGRESS_PER_MINUTE", fallback: 120 },
  admin: { envKey: "RATE_LIMIT_PUBLIC_PER_MINUTE", fallback: 120 },
};

export async function enforceRateLimit(request: Request, name: LimiterName): Promise<void> {
  const config = LIMITS[name];
  const limit = Number(process.env[config.envKey] ?? config.fallback);
  const windowSeconds = Number(process.env.RATE_LIMIT_WINDOW_SECONDS ?? 60);
  const key = `${name}:${clientIp(request)}`;

  const count = await cache().increment(`ratelimit:${key}`, windowSeconds);
  if (count > limit) {
    throw errors.rateLimited();
  }
}

export async function requireApiUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw errors.unauthorized();
  return user;
}

export async function requireApiAdmin(): Promise<SessionUser> {
  const user = await requireApiUser();
  if (user.role !== "ADMIN" && user.role !== "MODERATOR") throw errors.forbidden();
  return user;
}

export async function parseJson<T>(request: Request, schema: { parse: (value: unknown) => T }): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw errors.badRequest("Body JSON tidak valid");
  }
  return schema.parse(body);
}

export function noStoreHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    "cache-control": "private, no-store, max-age=0",
    ...extra,
  };
}

export function publicCacheHeaders(seconds: number, staleWhileRevalidate = seconds * 4): Record<string, string> {
  return {
    "cache-control": `public, s-maxage=${seconds}, stale-while-revalidate=${staleWhileRevalidate}`,
  };
}
