"use client";

import { ServerCrash, RotateCw } from "lucide-react";

export function ServerDownScreen({ onRetry, isRetrying }: { onRetry: () => void; isRetrying: boolean }) {
  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-background text-foreground font-sans p-6">
      <div className="w-full max-w-md text-center">
        <div className="relative mx-auto mb-8 w-20 h-20">
          <div className="absolute inset-0 rounded-full bg-accent/20 blur-2xl" />
          <div className="relative w-20 h-20 rounded-full border border-accent/30 bg-surface flex items-center justify-center">
            <ServerCrash className="w-9 h-9 text-accent" />
          </div>
        </div>

        <span className="text-xs font-bold uppercase tracking-widest text-accent">Connection Lost</span>
        <h1 className="mt-3 text-2xl md:text-3xl font-extrabold tracking-tight">
          We can&apos;t reach the server right now
        </h1>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          The app is unable to connect to VastraX. This page will automatically reconnect once the
          server is back — or try again now.
        </p>

        <button
          type="button"
          onClick={onRetry}
          disabled={isRetrying}
          className="mt-8 inline-flex items-center gap-2 px-8 py-3 bg-accent hover:bg-accent/90 text-white rounded-full font-bold text-xs uppercase tracking-widest transition-all disabled:opacity-70"
        >
          <RotateCw className={`w-4 h-4 ${isRetrying ? "animate-spin" : ""}`} />
          {isRetrying ? "Checking..." : "Retry Now"}
        </button>
      </div>
    </div>
  );
}
