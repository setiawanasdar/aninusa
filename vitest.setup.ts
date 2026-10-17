import "@testing-library/jest-dom/vitest";

process.env.NODE_ENV = process.env.NODE_ENV ?? "test";
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://test:test@localhost:5432/aninusa_test?schema=public";
process.env.AUTH_SECRET =
  process.env.AUTH_SECRET ?? "test-only-secret-test-only-secret-test-only-secret";
process.env.NEXT_PUBLIC_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
process.env.REDIS_URL = "";
process.env.LOG_LEVEL = "error";
