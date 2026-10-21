"use client";

import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useSession } from "next-auth/react";

export function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const isAdmin = status === "authenticated" && String((session?.user as { role?: string } | undefined)?.role || "").toLowerCase() === "admin";
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // The storefront is public. Only known dashboard routes receive the admin shell;
  // unknown URLs should render the application's real 404 page without dashboard chrome.
  const adminPrefixes = ["/products", "/categories", "/orders", "/users", "/restock-waitlist", "/crm", "/erp", "/admin", "/settings", "/stock-notifications", "/ai-assistant"];
  const isAdminArea = pathname === "/" || adminPrefixes.some((prefix) => pathname === prefix || pathname?.startsWith(prefix + "/"));

  if (pathname?.startsWith("/storefront") || (pathname === "/" && !isAdmin) || !isAdminArea) {
    return <div className="vx-storefront h-full bg-background text-foreground"><a className="vx-skip-link" href="#main-content">Skip to content</a>{children}</div>;
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <a className="vx-skip-link" href="#main-content">Skip to content</a>
      {/* Full-width Header */}
      <Header 
        isSidebarCollapsed={isSidebarCollapsed} 
        toggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
      />
      
      {/* Main Content Area (Sidebar + Page) */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar isCollapsed={isSidebarCollapsed} />
        <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto bg-background p-6 md:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
