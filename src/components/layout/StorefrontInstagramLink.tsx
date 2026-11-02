export default function StorefrontInstagramLink() {
  return (
    <a
      href="https://www.instagram.com/vastrax.ai/"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="VastraX on Instagram: vastrax.ai"
      className="inline-flex min-h-11 min-w-11 shrink-0 items-center gap-1.5 rounded-full px-1 text-xs font-semibold text-foreground/75 transition-colors hover:text-[#C13584] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:gap-2 sm:px-2 sm:text-sm 2xl:text-lg"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-[#C13584]" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="0.75" fill="currentColor" stroke="none" />
      </svg>
      <span className="hidden min-[360px]:inline min-[640px]:hidden lg:inline">vastrax.ai</span>
    </a>
  );
}
