"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { probeBackendHealth, subscribeToBackendStatus } from "@/lib/backendStatus";
import { ServerDownScreen } from "./ServerDownScreen";

const RECOVERY_POLL_MS = 8000;

type Status = "checking" | "up" | "down";

export function BackendStatusProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("up");
  const [isRetrying, setIsRetrying] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Background reachability probe
  useEffect(() => {
    let cancelled = false;
    probeBackendHealth().then((reachable) => {
      if (!cancelled && !reachable) setStatus("down");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // React to live connectivity signals from fetchApi / raw-fetch call sites during normal use.
  useEffect(() => {
    return subscribeToBackendStatus((reachable) => {
      setStatus(reachable ? "up" : "down");
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

  if (status === "down") {
    return <ServerDownScreen onRetry={handleRetry} isRetrying={isRetrying} />;
  }

  return <>{children}</>;
}
