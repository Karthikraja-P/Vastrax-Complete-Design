"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const STORAGE_KEY = "vastrax_cookie_choice";
const CLARITY_PROJECT_ID = "yey917sdqo"; // Existing VastraX project ID.
type Choice = "accepted" | "rejected" | null;
type ClarityApi = ((...args: unknown[]) => void) & { q?: unknown[][] };

function sendClarityConsent(analytics: boolean) {
  const host = window as Window & { clarity?: ClarityApi };
  if (!host.clarity && !analytics) return;
  if (!host.clarity) {
    const queue = ((...args: unknown[]) => { queue.q?.push(args); }) as ClarityApi;
    queue.q = [];
    host.clarity = queue;
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.clarity.ms/tag/${CLARITY_PROJECT_ID}`;
    script.dataset.vastraxAnalytics = "true";
    document.head.appendChild(script);
  }
  host.clarity("consentv2", {
    ad_Storage: "denied",
    analytics_Storage: analytics ? "granted" : "denied",
  });
}

export default function CookieConsent() {
  const pathname = usePathname();
  const [choice, setChoice] = useState<Choice>(null);
  const [ready, setReady] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const isStorefront = pathname?.startsWith("/storefront/") || pathname === "/storefront";

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "accepted") sendClarityConsent(true);
    requestAnimationFrame(() => {
      if (saved === "accepted" || saved === "rejected") setChoice(saved);
      setReady(true);
    });
    const openPreferences = () => setPreferencesOpen(true);
    window.addEventListener("vastrax:open-cookie-preferences", openPreferences);
    return () => window.removeEventListener("vastrax:open-cookie-preferences", openPreferences);
  }, []);

  const save = (next: Exclude<Choice, null>) => {
    localStorage.setItem(STORAGE_KEY, next);
    setChoice(next);
    setPreferencesOpen(false);
    sendClarityConsent(next === "accepted");
  };

  if (!ready || !isStorefront || (choice && !preferencesOpen)) return null;

  return (
    <section className="vx-cookie-panel" aria-label="Cookie preferences" aria-live="polite">
      <div className="vx-cookie-copy">
        <h2>{preferencesOpen ? "Cookie preferences" : "Your privacy choices"}</h2>
        <p>Essential cookies keep sign-in and checkout working. Optional Microsoft Clarity analytics stays off unless you allow it.</p>
        <a href="/storefront/privacy">Read the privacy policy</a>
      </div>
      {preferencesOpen ? (
        <div className="vx-cookie-controls vx-cookie-preference-controls">
          <label className="vx-cookie-toggle">
            <input type="checkbox" checked={choice === "accepted"} onChange={(event) => setChoice(event.target.checked ? "accepted" : "rejected")} />
            <span>Allow optional analytics</span>
          </label>
          <button type="button" onClick={() => save(choice === "accepted" ? "accepted" : "rejected")} className="vx-cookie-primary">Save choice</button>
          <button type="button" onClick={() => save("rejected")} className="vx-cookie-secondary">Reject optional</button>
        </div>
      ) : (
        <div className="vx-cookie-controls vx-cookie-initial-controls">
          <button type="button" onClick={() => save("accepted")} className="vx-cookie-primary">Allow analytics</button>
          <button type="button" onClick={() => save("rejected")} className="vx-cookie-secondary">Reject optional</button>
          <button type="button" onClick={() => setPreferencesOpen(true)} className="vx-cookie-secondary">Preferences</button>
        </div>
      )}
    </section>
  );
}
