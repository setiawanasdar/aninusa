import { PrismaClient } from "./generated/prisma";

const globalForPrisma = globalThis as unknown as { __aninusaPrisma?: PrismaClient };

export const prisma =
  globalForPrisma.__aninusaPrisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? [{ emit: "event", level: "warn" }, { emit: "event", level: "error" }]
        : [{ emit: "event", level: "error" }],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__aninusaPrisma = prisma;
}
