"use client";

import { useState } from "react";
import { fetchApi } from "@/lib/api";

export default function UnsubscribePage() {
  const [status, setStatus] = useState<"ready" | "sending" | "done" | "error">("ready");
  const [message, setMessage] = useState("Use the button below to stop Vastrax marketing emails.");

  const unsubscribe = async () => {
    const token = new URLSearchParams(window.location.search).get("token") || "";
    if (!token) {
      setStatus("error");
      setMessage("This unsubscribe link is missing its token. Open the link from the email again.");
      return;
    }
    setStatus("sending");
    try {
      await fetchApi("/crm/marketing/unsubscribe", {
        method: "POST",
        body: JSON.stringify({ token }),
      });
      setStatus("done");
      setMessage("You are unsubscribed from Vastrax marketing emails.");
    } catch {
      setStatus("error");
      setMessage("We could not process this link. Please manage marketing preferences from your Vastrax account.");
    }
  };

  return <main id="main-content" tabIndex={-1} className="flex min-h-screen items-center justify-center bg-background p-5">
    <section className="w-full max-w-lg space-y-4 rounded-2xl border border-border bg-surface p-7 text-center">
      <p className="text-xs font-semibold uppercase tracking-[.2em] text-accent">Vastrax preferences</p>
      <h1 className="text-2xl font-bold text-foreground">Email marketing preferences</h1>
      <p role="status" className="text-sm text-muted-foreground">{message}</p>
      {status !== "done" && <button disabled={status === "sending"} onClick={() => void unsubscribe()} className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
        {status === "sending" ? "Updating…" : "Unsubscribe from marketing emails"}
      </button>}
    </section>
  </main>;
}
