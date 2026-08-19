"use client";

import { useState } from "react";
import { Bell, Search, Menu } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

interface HeaderProps {
  isSidebarCollapsed?: boolean;
  toggleSidebar?: () => void;
  onOpenCart?: () => void;
}

export function Header({ isSidebarCollapsed, toggleSidebar, onOpenCart }: HeaderProps) {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const { data: session } = useSession();

  return (
    <header className="h-16 border-b border-border bg-surface flex items-center justify-between px-6 z-20">
      <div className="flex items-center gap-6 flex-1">
        {/* Logo and Toggle Button Container */}
        <div className="flex items-center gap-4 w-52 shrink-0">
          {toggleSidebar && (
            <button 
              onClick={toggleSidebar}
              className="p-1.5 rounded-md bg-surface-hover hover:bg-border transition-colors text-muted-foreground hover:text-foreground hidden md:block"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}
          {/* Mobile hamburger */}
          {toggleSidebar && (
            <button onClick={toggleSidebar} className="md:hidden text-muted-foreground hover:text-foreground">
              <Menu className="h-5 w-5" />
            </button>
          )}
          
          <Link href="/storefront/home" className="text-xl font-bold tracking-widest text-foreground hover:text-accent transition-colors">
            VASTRAX
          </Link>
        </div>

        <div className="flex items-center gap-6">
          <div className="relative w-full md:w-64 lg:w-80 hidden md:block group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-accent transition-colors" />
            <input
              type="text"
              placeholder="Search garments, orders, clients..."
              className="w-full bg-surface border border-border rounded-full py-1.5 pl-9 pr-14 text-sm text-foreground focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all placeholder:text-muted-foreground/50"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-50 pointer-events-none">
              <kbd className="font-sans text-[10px] bg-background border border-border rounded px-1 text-muted-foreground font-medium">Ctrl</kbd>
              <kbd className="font-sans text-[10px] bg-background border border-border rounded px-1 text-muted-foreground font-medium">K</kbd>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-4 shrink-0">
        <Link href="/storefront/home" className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-md border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
          Storefront
        </Link>

        <Link href="/" className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-md border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors">
          Dashboard
        </Link>

        <ThemeToggle />
        
        <button className="relative p-2 text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-surface-hover">
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-accent rounded-full border border-background"></span>
        </button>
        
        <div className="relative">
          <button 
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-2 ml-1 p-1 rounded-full md:rounded-md hover:bg-surface-hover transition-colors border border-transparent md:border-border/50 focus:outline-none"
          >
            <div className="h-7 w-7 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center overflow-hidden text-accent font-bold text-[10px] uppercase">
              {session?.user?.name ? session.user.name.charAt(0) : "AV"}
            </div>
            <span className="text-sm font-medium hidden md:block mr-1">
              {session?.user?.name || "Alexandre"}
            </span>
          </button>

          {isUserMenuOpen && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setIsUserMenuOpen(false)} 
              />
              <div className="absolute right-0 mt-2 w-48 bg-background border border-border rounded-xl shadow-lg py-2 z-50 overflow-hidden">
                <Link 
                  href="/storefront/account"
                  onClick={() => setIsUserMenuOpen(false)}
                  className="block w-full text-left px-4 py-3 text-sm font-medium text-foreground hover:bg-surface transition-colors"
                >
                  My Account
                </Link>
                <button 
                  onClick={() => { 
                    if (session) signOut();
                    setIsUserMenuOpen(false); 
                  }}
                  className="w-full text-left px-4 py-3 text-sm font-medium text-red-500 hover:bg-surface transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
