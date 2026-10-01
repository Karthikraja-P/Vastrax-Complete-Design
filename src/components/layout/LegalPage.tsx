import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { SITE } from "@/lib/site";

export type LegalSection = { title: string; body: (string | string[])[] };

export default function LegalPage({ title, sections }: { title: string; sections: LegalSection[] }) {
  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-background pt-24 pb-20 font-sans">
      <div className="max-w-4xl mx-auto px-4 md:px-8">
        <nav className="flex items-center gap-2 text-sm text-slate-500 dark:text-muted-foreground mb-8">
          <Link href="/storefront/home" aria-label="Home" className="hover:text-[#D4AF37]"><Home className="w-4 h-4" /></Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-slate-800 dark:text-foreground font-medium">{title}</span>
        </nav>
        <article className="bg-white dark:bg-card p-8 md:p-12 rounded-2xl shadow-sm border border-slate-100 dark:border-border">
          <h1 className="text-3xl md:text-4xl font-bold text-[#0A192F] dark:text-foreground tracking-tight">{title}</h1>
          <p className="text-xs text-slate-500 dark:text-muted-foreground mt-2 mb-10">Last updated: {SITE.updated}</p>
          <div className="space-y-8 text-slate-700 dark:text-muted-foreground leading-relaxed text-sm md:text-base">
            {sections.map((s, i) => (
              <section key={s.title} className="space-y-3">
                <h2 className="text-xl font-bold text-[#0A192F] dark:text-foreground">{i + 1}. {s.title}</h2>
                {s.body.map((b, j) =>
                  Array.isArray(b) ? (
                    <ul key={j} className="list-disc pl-6 space-y-1">{b.map((li) => <li key={li}>{li}</li>)}</ul>
                  ) : (
                    <p key={j}>{b}</p>
                  ),
                )}
              </section>
            ))}
            <p>Questions? Write to <a className="underline" href={`mailto:${SITE.email}`}>{SITE.email}</a>.</p>
          </div>
        </article>
      </div>
    </div>
  );
}
