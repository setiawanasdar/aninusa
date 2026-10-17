import http from "node:http";
import path from "node:path";
import { config } from "dotenv";
import { prisma } from "@aninusa/database";
import { runHealthSweep, runProviderSync, runScheduledSyncs } from "@aninusa/services";
import { createLogger, getErrorMessage } from "@aninusa/utils";

config({ path: path.resolve(__dirname, "../../../.env") });

const logger = createLogger({ service: "worker" });

const healthIntervalMs = Math.max(5, Number(process.env.SOURCE_HEALTH_INTERVAL_MINUTES ?? 15)) * 60_000;
const syncIntervalMs = Math.max(30, Number(process.env.SYNC_INTERVAL_MINUTES ?? 360)) * 60_000;
const port = Number(process.env.WORKER_PORT ?? 4001);

const state = {
  startedAt: new Date().toISOString(),
  lastHealthSweep: null as string | null,
  lastSync: null as string | null,
  lastError: null as string | null,
  running: false,
};

let shuttingDown = false;

function guard(name: string, task: () => Promise<void>) {
  return async () => {
    if (shuttingDown) return;
    if (state.running) {
      logger.warn("Skipping task because another job is running", { task: name });
      return;
    }

    state.running = true;
    const startedAt = Date.now();
    try {
      await task();
      state.lastError = null;
    } catch (error) {
      state.lastError = getErrorMessage(error);
      logger.error("Worker task failed", { task: name, error: state.lastError });
    } finally {
      state.running = false;
      logger.info("Worker task finished", { task: name, durationMs: Date.now() - startedAt });
    }
  };
}

const healthTask = guard("health-sweep", async () => {
  const summary = await runHealthSweep({ limit: 100 });
  state.lastHealthSweep = new Date().toISOString();
  logger.info("Health sweep completed", { ...summary });
});

const syncTask = guard("provider-sync", async () => {
  const results = await runScheduledSyncs();
  state.lastSync = new Date().toISOString();
  logger.info("Scheduled sync completed", {
    jobs: results.map((result) => ({ provider: result.stats.providerKey, status: result.status })),
  });
});

const server = http.createServer((request, response) => {
  if (request.url === "/healthz" || request.url === "/") {
    const healthy = !state.lastError;
    response.writeHead(healthy ? 200 : 503, { "content-type": "application/json" });
    response.end(
      JSON.stringify({
        status: healthy ? "ok" : "degraded",
        ...state,
        uptimeSeconds: Math.round(process.uptime()),
      }),
    );
    return;
  }

  if (request.url === "/run/health") {
    void healthTask();
    response.writeHead(202, { "content-type": "application/json" });
    response.end(JSON.stringify({ accepted: true }));
    return;
  }

  if (request.url === "/run/sync") {
    void syncTask();
    response.writeHead(202, { "content-type": "application/json" });
    response.end(JSON.stringify({ accepted: true }));
    return;
  }

  response.writeHead(404, { "content-type": "application/json" });
  response.end(JSON.stringify({ error: "not found" }));
});

async function bootstrap() {
  logger.info("Worker starting", {
    healthIntervalMinutes: healthIntervalMs / 60_000,
    syncIntervalMinutes: syncIntervalMs / 60_000,
    port,
  });

  server.listen(port, () => logger.info("Worker health server listening", { port }));

  // Run a first health sweep shortly after boot, then on a fixed cadence.
  setTimeout(() => void healthTask(), 15_000);
  setInterval(() => void healthTask(), healthIntervalMs);
  setInterval(() => void syncTask(), syncIntervalMs);

  // Optional one-shot sync at boot, useful for fresh deployments.
  if (process.env.SYNC_ON_BOOT === "true") {
    setTimeout(() => void syncTask(), 5_000);
  }

  if (process.env.SYNC_PROVIDER_ON_BOOT) {
    setTimeout(() => {
      void runProviderSync({
        providerKey: process.env.SYNC_PROVIDER_ON_BOOT as string,
        mode: "INCREMENTAL",
        limit: 12,
        triggeredBy: "worker-boot",
      }).catch((error) => logger.error("Boot sync failed", { error: getErrorMessage(error) }));
    }, 8_000);
  }
}

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info("Worker shutting down", { signal });

  server.close();
  await prisma.$disconnect().catch(() => undefined);
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled rejection", { error: getErrorMessage(reason) });
});

bootstrap().catch((error) => {
  logger.error("Worker failed to start", { error: getErrorMessage(error) });
  process.exit(1);
});
