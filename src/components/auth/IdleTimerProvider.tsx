"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { performSignOut } from "@/lib/auth-utils";
import { AlertTriangle, Clock, LogOut, CheckCircle } from "lucide-react";

// Inactivity timeout configurations
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const WARNING_DURATION_MS = 60 * 1000;   // 60 seconds warning before logout
const ACTIVITY_THROTTLE_MS = 1000;       // Throttle activity event listeners

export function IdleTimerProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(60);

  const lastActivityRef = useRef<number>(Date.now());
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastThrottleRef = useRef<number>(0);

  const isAuthenticated = status === "authenticated" || (typeof window !== "undefined" && !!localStorage.getItem("vastrax_token"));

  const clearAllTimers = useCallback(() => {
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    warningTimerRef.current = null;
    countdownIntervalRef.current = null;
  }, []);

  const handleLogout = useCallback(async () => {
    clearAllTimers();
    setShowWarning(false);
    await performSignOut("/storefront/home?reason=inactivity");
  }, [clearAllTimers]);

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    clearAllTimers();
    setShowWarning(false);
    setSecondsLeft(60);

    if (!isAuthenticated) return;

    // Set timer to trigger warning at (IDLE_TIMEOUT_MS - WARNING_DURATION_MS)
    const timeUntilWarning = IDLE_TIMEOUT_MS - WARNING_DURATION_MS;
    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true);
      setSecondsLeft(60);

      // Start 1-second countdown
      const startTime = Date.now();
      countdownIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const remaining = Math.max(0, 60 - elapsed);
        setSecondsLeft(remaining);

        if (remaining <= 0) {
          clearInterval(countdownIntervalRef.current!);
          handleLogout();
        }
      }, 1000);
    }, timeUntilWarning);
  }, [isAuthenticated, clearAllTimers, handleLogout]);

  // Activity handler
  const handleUserActivity = useCallback(() => {
    // If warning is already showing, do not auto-dismiss on passive mouse movement
    // The user must explicitly click "Stay Logged In"
    if (showWarning) return;

    const now = Date.now();
    if (now - lastThrottleRef.current > ACTIVITY_THROTTLE_MS) {
      lastThrottleRef.current = now;
      resetTimer();
    }
  }, [showWarning, resetTimer]);

  useEffect(() => {
    if (typeof window !== "undefined" && (session as any)?.accessToken) {
      const current = localStorage.getItem("vastrax_token");
      if (current !== (session as any).accessToken) {
        localStorage.setItem("vastrax_token", (session as any).accessToken);
      }
    }
  }, [session]);

  useEffect(() => {
    if (!isAuthenticated) {
      clearAllTimers();
      setShowWarning(false);
      return;
    }

    resetTimer();

    const events = ["mousedown", "keydown", "touchstart", "scroll", "wheel"];
    const throttledMouseMove = (e: Event) => handleUserActivity();

    events.forEach((evt) => window.addEventListener(evt, handleUserActivity, { passive: true }));
    window.addEventListener("mousemove", throttledMouseMove, { passive: true });

    return () => {
      clearAllTimers();
      events.forEach((evt) => window.removeEventListener(evt, handleUserActivity));
      window.removeEventListener("mousemove", throttledMouseMove);
    };
  }, [isAuthenticated, resetTimer, clearAllTimers, handleUserActivity]);

  return (
    <>
      {children}

      {/* Inactivity Warning Modal */}
      {showWarning && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="relative w-full max-w-md bg-surface border border-border rounded-2xl p-6 shadow-2xl space-y-6 text-foreground text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
              <Clock className="w-8 h-8 animate-pulse" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-bold tracking-tight text-foreground">
                Inactivity Warning
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                You have been inactive. For your security, you will be automatically signed out in:
              </p>
              <div className="text-4xl font-extrabold font-mono text-amber-500 pt-2">
                {secondsLeft}s
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={resetTimer}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white bg-accent hover:bg-accent/90 shadow-[0_0_15px_rgba(224,122,63,0.3)] transition-all"
              >
                <CheckCircle className="w-4 h-4" />
                Stay Logged In
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-muted-foreground hover:text-red-400 bg-surface-hover hover:bg-red-500/10 border border-border hover:border-red-500/30 transition-all"
              >
                <LogOut className="w-4 h-4" />
                Sign Out Now
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
