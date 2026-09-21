"use client";

import { SessionProvider } from "next-auth/react";
import { IdleTimerProvider } from "@/components/auth/IdleTimerProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <IdleTimerProvider>{children}</IdleTimerProvider>
    </SessionProvider>
  );
}
