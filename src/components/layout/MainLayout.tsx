"use client";

import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { usePathname } from "next/navigation";
import { useState } from "react";

export function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  if (pathname?.startsWith("/storefront")) {
    return <div className="h-full bg-background text-foreground">{children}</div>;
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Full-width Header */}
      <Header 
        isSidebarCollapsed={isSidebarCollapsed} 
        toggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
      />
      
      {/* Main Content Area (Sidebar + Page) */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar isCollapsed={isSidebarCollapsed} />
        <main className="flex-1 overflow-y-auto bg-background p-6 md:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
