"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Sparkles,
  Package,
  Tags,
  ShoppingCart,
  Users,
  LayoutTemplate,
  UserCog,
  ShieldCheck,
  Settings,
  Store,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const navGroups = [
  {
    title: "",
    items: [
      { name: "Overview", href: "/", icon: LayoutDashboard },
      { name: "AI Assistant", href: "/ai-assistant", icon: Sparkles },
    ],
  },
  {
    title: "CATALOGUE",
    items: [
      {
        name: "Products",
        icon: Package,
        subItems: [
          { name: "All Products", href: "/products" },
          { name: "Deleted", href: "/products/deleted" },
        ],
      },
      {
        name: "Categories",
        icon: Tags,
        subItems: [
          { name: "All Categories", href: "/categories" },
          { name: "Deleted", href: "/categories/deleted" },
        ],
      },
    ],
  },
  {
    title: "SALES",
    items: [
      { name: "Orders", href: "/orders", icon: ShoppingCart },
      { 
        name: "Users", 
        icon: Users,
        subItems: [
          { name: "All Users", href: "/users" },
          { name: "Deleted", href: "/users/deleted" },
        ]
      },
    ],
  },
  {
    title: "STOREFRONT",
    items: [
      { name: "Home Page", href: "/storefront/home", icon: LayoutTemplate },
    ],
  },
  {
    title: "ADMINISTRATION",
    items: [
      { name: "Admin Management", href: "/admin/management", icon: UserCog },
      { name: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

export function Sidebar({ isCollapsed = false }: { isCollapsed?: boolean }) {
  const pathname = usePathname();
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({
    "Products": true,
    "Users": true,
    "Categories": true
  });

  const toggleMenu = (name: string) => {
    if (isCollapsed) return; // Don't toggle submenus when collapsed
    setOpenMenus((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  return (
    <aside 
      className={cn(
        "h-full bg-surface border-r border-border flex-col hidden md:flex z-10 sticky top-0 transition-all duration-300 ease-in-out overflow-hidden",
        isCollapsed ? "w-20" : "w-64"
      )}
    >
      <div className="flex-1 overflow-y-auto py-6 px-4 space-y-8 scrollbar-thin scrollbar-thumb-border hover:scrollbar-thumb-border-hover scrollbar-track-transparent">
        {navGroups.map((group, groupIdx) => (
          <div key={groupIdx} className="relative">
            
            {/* Divider in collapsed mode instead of title */}
            {isCollapsed && groupIdx > 0 && group.title && (
              <div className="w-8 h-[1px] bg-border mx-auto mb-4" />
            )}

            {!isCollapsed && group.title && (
              <h3 className="px-2 text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3">
                {group.title}
              </h3>
            )}

            <ul className="space-y-1">
              {group.items.map((item) => {
                const isActive =
                  item.href &&
                  (pathname === item.href || pathname.startsWith(`${item.href}/`)) &&
                  item.href !== "/";
                const isExactActive = pathname === item.href;

                if (item.subItems) {
                  const isAnySubActive = item.subItems.some(
                    (sub) => pathname === sub.href
                  );
                  const isOpen = openMenus[item.name] && !isCollapsed;

                  return (
                    <li key={item.name}>
                      <button
                        onClick={() => toggleMenu(item.name)}
                        title={isCollapsed ? item.name : undefined}
                        className={cn(
                          "w-full flex items-center justify-between py-2.5 rounded-md transition-colors",
                          isCollapsed ? "px-0 justify-center" : "px-2",
                          isAnySubActive
                            ? "text-accent bg-accent/5"
                            : "text-foreground hover:bg-surface-hover hover:text-foreground"
                        )}
                      >
                        <div className={cn("flex items-center w-full", isCollapsed && "justify-center")}>
                          <item.icon
                            className={cn(
                              "h-5 w-5 shrink-0",
                              isAnySubActive ? "text-accent" : "text-muted-foreground",
                              !isCollapsed && "mr-3"
                            )}
                          />
                          {!isCollapsed && <span className="text-sm font-medium">{item.name}</span>}
                        </div>
                        {!isCollapsed && (
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 shrink-0 transition-transform text-muted-foreground ml-auto",
                              isOpen && "rotate-180"
                            )}
                          />
                        )}
                      </button>
                      <AnimatePresence>
                        {isOpen && !isCollapsed && (
                          <motion.ul
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="mt-1 space-y-1 overflow-hidden"
                          >
                            {item.subItems.map((sub) => (
                              <li key={sub.name}>
                                <Link
                                  href={sub.href}
                                  className={cn(
                                    "block px-2 py-2 pl-10 text-sm font-medium rounded-md transition-colors",
                                    pathname === sub.href
                                      ? "text-accent bg-accent/10"
                                      : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
                                  )}
                                >
                                  {sub.name}
                                </Link>
                              </li>
                            ))}
                          </motion.ul>
                        )}
                      </AnimatePresence>
                    </li>
                  );
                }

                return (
                  <li key={item.name}>
                    <Link
                      href={item.href!}
                      title={isCollapsed ? item.name : undefined}
                      className={cn(
                        "flex items-center py-2.5 rounded-md transition-colors relative",
                        isCollapsed ? "px-0 justify-center" : "px-2",
                        isExactActive || isActive
                          ? "text-accent bg-accent/5"
                          : "text-foreground hover:bg-surface-hover"
                      )}
                    >
                      <item.icon
                        className={cn(
                          "h-5 w-5 shrink-0",
                          isExactActive || isActive
                            ? "text-accent"
                            : "text-muted-foreground",
                          !isCollapsed && "mr-3"
                        )}
                      />
                      {!isCollapsed && <span className="text-sm font-medium">{item.name}</span>}
                      
                      {(isExactActive || isActive) && (
                        <motion.div
                          layoutId="active-indicator"
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-accent rounded-r-full"
                        />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

    </aside>
  );
}
