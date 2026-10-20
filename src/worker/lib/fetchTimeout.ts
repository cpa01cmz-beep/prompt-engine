export const DEFAULT_FETCH_TIMEOUT_MS = 30_000;

/**
 * Fetch with an AbortController-backed timeout so a hung upstream never wedges
 * the Worker request. The timer is cleared once the fetch settles.
 */
export async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
