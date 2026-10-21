import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <main id="main-content" tabIndex={-1} className="vx-not-found" aria-labelledby="not-found-title">
      <p className="vx-kicker">VASTRAX</p>
      <h1 id="not-found-title">This page is out of the edit.</h1>
      <p>The address may have changed, or the page may no longer be available.</p>
      <Link href="/storefront/home" className="vx-primary-cta inline-flex min-h-12 items-center gap-3 rounded-full px-6 py-3 font-semibold">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Back to VastraX
      </Link>
    </main>
  );
}
