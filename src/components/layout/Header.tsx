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

export interface HeaderNotification {
  id: string;
  title: string;
  description: string;
  time: string;
  type: "order" | "stock" | "user" | "ai";
  read: boolean;
  href: string;
}

export function Header({ isSidebarCollapsed, toggleSidebar, onOpenCart }: HeaderProps) {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const { data: session } = useSession();

  const [notifications, setNotifications] = useState<HeaderNotification[]>([
    {
      id: "notif-1",
      title: "New High-Value Order #ORD-2026-1048",
      description: "Confirmed luxury order for $1,280.00 via Express Shipping.",
      time: "10m ago",
      type: "order",
      read: false,
      href: "/orders",
    },
    {
      id: "notif-2",
      title: "Low Inventory Alert",
      description: "Cream Pullover Hoodie stock dropped below 5 units.",
      time: "45m ago",
      type: "stock",
      read: false,
      href: "/products",
    },
    {
      id: "notif-3",
      title: "AI Stylist Recommendation Spike",
      description: "Over 48 clients generated virtual try-on combinations today.",
      time: "2h ago",
      type: "ai",
      read: true,
      href: "/storefront/home",
    },
    {
      id: "notif-4",
      title: "New VIP Customer Registered",
      description: "Sophia Sterling created a luxury atelier account.",
      time: "5h ago",
      type: "user",
      read: true,
      href: "/users",
    },
  ]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

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
        
        {/* Notification Bell & Popover */}
        <div className="relative">
          <button 
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className="relative p-2 text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-surface-hover focus:outline-none"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[14px] h-[14px] px-1 bg-accent text-[9px] font-bold text-white rounded-full flex items-center justify-center border border-background">
                {unreadCount}
              </span>
            )}
          </button>

          {isNotificationsOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsNotificationsOpen(false)} />
              <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-background border border-border rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-foreground">Notifications</h3>
                    {unreadCount > 0 && (
                      <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-accent/15 text-accent rounded-full border border-accent/30">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button 
                      onClick={markAllAsRead}
                      className="text-xs text-accent hover:text-accent-hover font-medium transition-colors"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                {/* Notification List */}
                <div className="max-h-[340px] overflow-y-auto divide-y divide-border/40">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-muted-foreground text-xs">
                      No notifications at this time.
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <Link 
                        key={notif.id}
                        href={notif.href}
                        onClick={() => {
                          markAsRead(notif.id);
                          setIsNotificationsOpen(false);
                        }}
                        className={`block p-3.5 hover:bg-surface-hover/60 transition-colors ${!notif.read ? 'bg-accent/5' : ''}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${!notif.read ? 'bg-accent' : 'bg-transparent'}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-foreground truncate">{notif.title}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">{notif.description}</p>
                            <span className="text-[10px] text-muted-foreground/70 mt-1 block">{notif.time}</span>
                          </div>
                        </div>
                      </Link>
                    ))
                  )}
                </div>

                {/* Footer */}
                <div className="p-2.5 bg-surface/50 border-t border-border/50 text-center">
                  <Link 
                    href="/orders" 
                    onClick={() => setIsNotificationsOpen(false)}
                    className="text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
                  >
                    View All Activity →
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>
        
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
