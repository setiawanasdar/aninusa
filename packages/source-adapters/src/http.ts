import { fetchWithTimeout } from "@aninusa/utils";
import { ProviderError } from "./types";

export interface ProviderFetchOptions {
  timeoutMs: number;
  userAgent: string;
  headers?: Record<string, string>;
}

/**
 * Fetch wrapper for authorized providers. It never adds credentials a provider
 * did not explicitly grant, never solves challenges, and treats 401/403/429 as
 * terminal conditions instead of attempting to evade them.
 */
export async function providerFetch(
  url: string,
  init: RequestInit,
  options: ProviderFetchOptions,
): Promise<Response> {
  let response: Response;
  try {
    response = await fetchWithTimeout(
      url,
      {
        ...init,
        redirect: init.redirect ?? "follow",
        headers: {
          "user-agent": options.userAgent,
          ...(init.headers ?? {}),
          ...(options.headers ?? {}),
        },
      },
      options.timeoutMs,
    );
  } catch (error) {
    throw new ProviderError(
      error instanceof Error && error.name === "AbortError"
        ? "Provider request timed out"
        : `Provider request failed: ${error instanceof Error ? error.message : "unknown error"}`,
      { retryable: true },
    );
  }

  if (response.status === 401 || response.status === 403) {
    throw new ProviderError(
      `Provider denied automated access (${response.status}). The provider is treated as unsupported; no access controls are bypassed.`,
      { retryable: false, status: response.status },
    );
  }

  if (response.status === 429) {
    throw new ProviderError("Provider rate limit reached (429)", {
      retryable: true,
      status: 429,
    });
  }

  if (response.status >= 500) {
    throw new ProviderError(`Provider is unavailable (${response.status})`, {
      retryable: true,
      status: response.status,
    });
  }

  if (!response.ok) {
    throw new ProviderError(`Provider returned HTTP ${response.status}`, {
      retryable: false,
      status: response.status,
    });
  }

  return response;
}

export async function providerJson<T>(
  url: string,
  init: RequestInit,
  options: ProviderFetchOptions,
): Promise<T> {
  const response = await providerFetch(url, init, options);
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new ProviderError(`Unexpected provider content type: ${contentType || "unknown"}`, {
      retryable: false,
    });
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new ProviderError("Provider returned invalid JSON", { retryable: true });
  }
}

export class RateGate {
  private readonly intervalMs: number;
  private nextAllowedAt = 0;

  constructor(requestsPerMinute: number) {
    this.intervalMs = Math.ceil(60_000 / Math.max(1, requestsPerMinute));
  }

  async wait(): Promise<void> {
    const now = Date.now();
    const waitMs = Math.max(0, this.nextAllowedAt - now);
    this.nextAllowedAt = Math.max(now, this.nextAllowedAt) + this.intervalMs;
    if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
}
