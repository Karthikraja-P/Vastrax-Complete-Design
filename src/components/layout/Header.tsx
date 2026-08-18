"use client";

import { Bell, Search, Menu } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

interface HeaderProps {
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

export function Header({ isSidebarCollapsed, toggleSidebar }: HeaderProps) {
  return (
    <header className="h-16 border-b border-border bg-surface flex items-center justify-between px-6 z-20">
      <div className="flex items-center gap-6 flex-1">
        {/* Logo and Toggle Button Container */}
        <div className="flex items-center gap-4 w-52 shrink-0">
          <button 
            onClick={toggleSidebar}
            className="p-1.5 rounded-md bg-surface-hover hover:bg-border transition-colors text-muted-foreground hover:text-foreground hidden md:block"
          >
            <Menu className="h-5 w-5" />
          </button>
          {/* Mobile hamburger (no state) */}
          <button className="md:hidden text-muted-foreground hover:text-foreground">
            <Menu className="h-5 w-5" />
          </button>
          
          <h1 className="text-xl font-bold tracking-widest text-foreground hidden md:block">
            VASTRAX
          </h1>
        </div>

        <div className="flex items-center gap-6">
          <div className="relative w-full md:w-64 lg:w-80 hidden md:block group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-accent transition-colors" />
            <input
              type="text"
              placeholder="Search..."
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
        <a href="/storefront/home" className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-md border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
          Go to storefront
        </a>

        <ThemeToggle />
        
        <button className="relative p-2 text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-surface-hover">
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-accent rounded-full border border-background"></span>
        </button>
        
        <button className="flex items-center gap-2 ml-1 p-1 rounded-full md:rounded-md hover:bg-surface-hover transition-colors border border-transparent md:border-border/50">
          <div className="h-7 w-7 rounded-full bg-surface-hover border border-border flex items-center justify-center overflow-hidden">
            <span className="text-[10px] font-bold">DT</span>
          </div>
          <span className="text-sm font-medium hidden md:block mr-1">Demo</span>
          <svg className="hidden md:block text-muted-foreground" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
        </button>
      </div>
    </header>
  );
}
