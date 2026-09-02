/**
 * Global backend-reachability signal.
 *
 * Framework-free pub/sub (no React import) so both `api.ts`'s `fetchApi` and any
 * raw-`fetch` call site can report connectivity without pulling React into this module.
 * `BackendStatusProvider` is the sole consumer that turns this into UI state.
 */

type BackendStatusListener = (reachable: boolean) => void;

const listeners = new Set<BackendStatusListener>();

export function reportBackendReachable(): void {
  listeners.forEach((cb) => cb(true));
}

export function reportBackendUnreachable(): void {
  listeners.forEach((cb) => cb(false));
}

export function subscribeToBackendStatus(cb: BackendStatusListener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

const DEFAULT_ORIGIN =
  typeof window !== "undefined"
    ? ""
    : (process.env.INTERNAL_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8090").replace(/\/api\/v1\/?$/, "");

/** Raw, unauthenticated probe against the backend's unprefixed `GET /health` route. */
export async function probeBackendHealth(timeoutMs = 4000): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${DEFAULT_ORIGIN}/health`, { signal: controller.signal, cache: "no-store" });
    const reachable = res.ok;
    if (reachable) reportBackendReachable();
    else reportBackendUnreachable();
    return reachable;
  } catch {
    reportBackendUnreachable();
    return false;
  } finally {
    clearTimeout(timer);
  }
}
