import React from "react";
import { cn } from "@/lib/utils";

interface NotchedCardProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  actionIcon1?: React.ReactNode;
  actionIcon2?: React.ReactNode;
}

export function NotchedCard({
  title,
  subtitle,
  children,
  className,
  actionIcon1,
  actionIcon2,
}: NotchedCardProps) {
  return (
    <div className={cn("relative group", className)}>
      {/* Background with clip-path and grid */}
      <div 
        className="absolute inset-0 bg-surface rounded-3xl transition-all duration-300 shadow-[0_8px_30px_rgb(0,0,0,0.12)]"
        style={{
          clipPath: "polygon(0 0, calc(100% - 100px) 0, calc(100% - 80px) 24px, 100% 24px, 100% 100%, 0 100%)",
        }}
      >
        {/* Subtle Grid Pattern Overlay */}
        <div 
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)`,
            backgroundSize: '20px 20px'
          }}
        />
        {/* Border simulation (since clip-path hides real borders on the clipped edge) */}
        <div 
          className="absolute inset-0 pointer-events-none rounded-3xl"
          style={{
            background: "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 100%)",
            padding: "1px",
            WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
            clipPath: "polygon(0 0, calc(100% - 100px) 0, calc(100% - 80px) 24px, 100% 24px, 100% 100%, 0 100%)",
          }}
        />
      </div>

      {/* Floating Action Buttons in the "Notch" space */}
      <div className="absolute top-0 right-0 flex gap-2 h-6 items-start justify-end w-[100px]">
        {actionIcon1 && (
          <button className="w-8 h-8 rounded-full bg-[#111] border border-border flex items-center justify-center text-muted-foreground hover:text-accent hover:border-accent transition-all -mt-2 shadow-lg relative">
            {actionIcon1}
            <span className="absolute top-1 right-1.5 w-1.5 h-1.5 bg-accent rounded-full" />
          </button>
        )}
        {actionIcon2 && (
          <button className="w-8 h-8 rounded-full bg-[#111] border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground transition-all -mt-2 shadow-lg">
            {actionIcon2}
          </button>
        )}
      </div>

      {/* Content */}
      <div className="relative z-10 p-6 h-full flex flex-col">
        {(title || subtitle) && (
          <div className="mb-4">
            {subtitle && <p className="text-xs font-medium text-muted-foreground mb-1">{subtitle}</p>}
            {title && <h3 className="text-sm font-bold text-foreground">{title}</h3>}
          </div>
        )}
        <div className="flex-1 flex flex-col">
          {children}
        </div>
      </div>
    </div>
  );
}
