import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

export const metadata: Metadata = {
  title: "Offers | VastraX",
  description: "Explore current VastraX offers, including free shipping on orders above ₹1,499 across India.",
  alternates: { canonical: "/storefront/offers" },
  robots: { index: true, follow: true },
};

export default function OffersPage() {
  return (
    <main id="main-content" className="min-h-screen bg-[#fbf9f6] px-4 pb-20 pt-16 text-[#29231f] dark:bg-background dark:text-foreground sm:pt-24">
      <div className="mx-auto max-w-4xl">
        <Link href="/storefront/home" className="text-sm font-medium text-[#a84d25] hover:underline">← Back to VastraX</Link>
        <section className="mt-8 overflow-hidden rounded-3xl border border-[#e5ded6] bg-white shadow-sm dark:border-border dark:bg-card">
          <div className="bg-gradient-to-r from-[#873b1f] via-[#a84d25] to-[#c16b3e] px-6 py-10 text-white sm:px-10">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em]"><Sparkles aria-hidden="true" className="h-4 w-4" /> VastraX offers</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">A little something on us.</h1>
          </div>
          <div className="p-6 sm:p-10">
            <article className="rounded-2xl border border-[#e5ded6] bg-[#fbf9f6] p-5 dark:border-border dark:bg-background sm:p-7">
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#a84d25]">Free shipping</p>
              <h2 className="mt-2 text-2xl font-semibold">On orders above ₹1,499</h2>
              <p className="mt-3 max-w-2xl leading-relaxed text-[#6f6257] dark:text-muted-foreground">
                Enjoy free shipping when your product subtotal is more than ₹1,499. Orders of ₹1,499 or less have a flat ₹80 shipping charge, the same across India.
              </p>
            </article>
            <Link href="/storefront/collections?gender=Women" className="mt-7 inline-flex min-h-12 items-center gap-3 rounded-full bg-[#a84d25] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#873b1f]">
              Shop the collection <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
