export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const SECRET_KEY = /(password|secret|token|authorization|cookie|apikey|api_key)/i;

function serialize(value: unknown, depth = 0): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  if (depth > 3) return "[truncated]";
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => serialize(item, depth + 1));
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      result[key] = SECRET_KEY.test(key) ? "[redacted]" : serialize(entry, depth + 1);
    }
    return result;
  }
  return value;
}

function currentLevel(): LogLevel {
  const configured = (process.env.LOG_LEVEL ?? "info").toLowerCase();
  return configured === "debug" || configured === "warn" || configured === "error" ? configured : "info";
}

export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  child(context: Record<string, unknown>): Logger;
}

function emit(level: LogLevel, message: string, context?: Record<string, unknown>, base?: Record<string, unknown>) {
  if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[currentLevel()]) return;

  const line = JSON.stringify({
    time: new Date().toISOString(),
    level,
    message,
    ...(base ? (serialize(base) as Record<string, unknown>) : {}),
    ...(context ? (serialize(context) as Record<string, unknown>) : {}),
  });

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function createLogger(base?: Record<string, unknown>): Logger {
  return {
    debug: (message, context) => emit("debug", message, context, base),
    info: (message, context) => emit("info", message, context, base),
    warn: (message, context) => emit("warn", message, context, base),
    error: (message, context) => emit("error", message, context, base),
    child: (context) => createLogger({ ...base, ...context }),
  };
}

export const logger = createLogger({ service: "aninusa" });

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown error";
}
