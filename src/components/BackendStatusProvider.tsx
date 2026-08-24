"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { probeBackendHealth, subscribeToBackendStatus } from "@/lib/backendStatus";
import { ServerDownScreen } from "./ServerDownScreen";

const RECOVERY_POLL_MS = 8000;

type Status = "checking" | "up" | "down";

export function BackendStatusProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("checking");
  const [isRetrying, setIsRetrying] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Gate initial render on a real reachability probe — never let a page mount and fetch
  // (and potentially fall back to mock data) before we know the backend is actually up.
  useEffect(() => {
    let cancelled = false;
    probeBackendHealth().then((reachable) => {
      if (!cancelled) setStatus(reachable ? "up" : "down");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // React to live connectivity signals from fetchApi / raw-fetch call sites during normal use.
  useEffect(() => {
    return subscribeToBackendStatus((reachable) => {
      setStatus((prev) => {
        if (reachable) return prev === "checking" ? prev : "up";
        return "down";
      });
    });
  }, []);

  // While down, poll for recovery so the app comes back on its own without a manual refresh.
  useEffect(() => {
    if (status !== "down") {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    pollRef.current = setInterval(async () => {
      const reachable = await probeBackendHealth();
      if (reachable) setStatus("up");
    }, RECOVERY_POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [status]);

  const handleRetry = async () => {
    setIsRetrying(true);
    const reachable = await probeBackendHealth();
    setIsRetrying(false);
    if (reachable) setStatus("up");
  };

  if (status === "checking") {
    return (
      <div className="fixed inset-0 z-[999] flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (status === "down") {
    return <ServerDownScreen onRetry={handleRetry} isRetrying={isRetrying} />;
  }

  return <>{children}</>;
}
