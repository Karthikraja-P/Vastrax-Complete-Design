"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Menu, Search, X } from "lucide-react";

const links = [
  { label: "Collections", href: "/storefront/collections?gender=Women" },
];

interface StorefrontMobileControlsProps {
  showMenu?: boolean;
}

export default function StorefrontMobileControls({ showMenu = true }: StorefrontMobileControlsProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;
    setSearchOpen(false);
    router.push("/storefront/collections?search=" + encodeURIComponent(value));
  };

  return (
    <div className="relative z-[60] flex items-center gap-1 2xl:hidden">
      {showMenu && <button
        type="button"
        aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={menuOpen}
        onClick={() => {
          setMenuOpen((open) => !open);
          setSearchOpen(false);
        }}
        className="rounded-full p-2 text-foreground/80 transition-colors hover:bg-black/5 hover:text-accent dark:hover:bg-white/10"
      >
        {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>}
      <button
        type="button"
        aria-label={searchOpen ? "Close product search" : "Search products"}
        aria-expanded={searchOpen}
        onClick={() => {
          setSearchOpen((open) => !open);
          setMenuOpen(false);
        }}
        className="rounded-full p-2 text-foreground/80 transition-colors hover:bg-black/5 hover:text-accent dark:hover:bg-white/10"
      >
        {searchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
      </button>

      {showMenu && menuOpen && (
        <nav aria-label="Store navigation" className="absolute left-0 top-full mt-3 w-[min(88vw,20rem)] rounded-2xl border border-border bg-background p-3 text-foreground shadow-xl dark:bg-[#1a1a1a]">
          {links.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="block rounded-xl px-4 py-3 text-sm font-medium transition-colors hover:bg-surface hover:text-accent dark:hover:bg-white/5"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}

      {searchOpen && (
        <form onSubmit={submitSearch} role="search" className="absolute left-0 top-full mt-3 flex w-[min(88vw,24rem)] items-center gap-2 rounded-2xl border border-border bg-background p-3 shadow-xl dark:bg-[#1a1a1a]">
          <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search products..."
            aria-label="Search products"
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <button type="submit" className="rounded-full bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground">
            Search
          </button>
        </form>
      )}
    </div>
  );
}
