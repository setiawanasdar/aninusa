import { z } from "zod";

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().optional(),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  SESSION_COOKIE_NAME: z.string().default("aninusa_session"),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(7),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  SITE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SITE_NAME: z.string().default("AniNusa"),
  SITE_NAME: z.string().optional(),
  RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().min(10).max(3600).default(60),
  RATE_LIMIT_PUBLIC_PER_MINUTE: z.coerce.number().int().min(10).max(100_000).default(120),
  RATE_LIMIT_AUTH_PER_MINUTE: z.coerce.number().int().min(1).max(1_000).default(10),
  RATE_LIMIT_PROGRESS_PER_MINUTE: z.coerce.number().int().min(10).max(100_000).default(120),
  SUBTITLE_HOST_ALLOWLIST: z.string().default(""),
  LOG_LEVEL: z.string().default("info"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | null = null;

export function serverEnv(): ServerEnv {
  if (cached) return cached;

  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`Invalid environment configuration:\n${issues.join("\n")}`);
  }

  cached = parsed.data;
  return cached;
}

/**
 * Canonical origin.
 *
 * `NEXT_PUBLIC_SITE_URL` is inlined by Next at build time, so it cannot change
 * per environment. `SITE_URL` is a server-only runtime variable and takes
 * precedence, which lets one image serve staging and production.
 */
export function siteUrl(): string {
  return (
    process.env.SITE_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export function siteName(): string {
  return process.env.SITE_NAME ?? process.env.NEXT_PUBLIC_SITE_NAME ?? "AniNusa";
}
