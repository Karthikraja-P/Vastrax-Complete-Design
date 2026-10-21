"use client";

import Link from "next/link";
import { SITE } from "@/lib/site";

const LINKS = [
  ["Privacy Policy", "/storefront/privacy"],
  ["Terms of Service", "/storefront/terms"],
  ["Returns & Refunds", "/storefront/refund-policy"],
  ["Shipping", "/storefront/shipping-policy"],
] as const;

export default function StorefrontFooter() {
  return (
    <footer className="vx-footer border-t border-slate-200 dark:border-border bg-white dark:bg-card py-8 text-sm text-slate-600 dark:text-muted-foreground">
      <div className="max-w-6xl mx-auto px-4 md:px-8 flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
        <p>&copy; {new Date().getFullYear()} {SITE.name}. All rights reserved.</p>
        <nav aria-label="Legal" className="flex flex-wrap gap-x-6 gap-y-2">
          {LINKS.map(([label, href]) => <Link key={href} href={href} className="hover:text-[#D4AF37]">{label}</Link>)}
          <a href={`mailto:${SITE.email}`} className="hover:text-[#D4AF37]">{SITE.email}</a>
          <button type="button" onClick={() => window.dispatchEvent(new Event("vastrax:open-cookie-preferences"))} className="vx-cookie-open">Cookie preferences</button>
        </nav>
      </div>
    </footer>
  );
}
