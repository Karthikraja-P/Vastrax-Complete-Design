"use client";

import { useState } from "react";
import { ArrowLeft, Save, Sparkles, Image as ImageIcon, Box, Shirt, Video, Plus } from "lucide-react";
import Link from "next/link";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { AiVideoGenerator } from "@/components/products/AiVideoGenerator";

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

const tabs = [
  { id: "basic", label: "Basic Info" },
  { id: "pricing", label: "Pricing & Inventory" },
  { id: "images", label: "Product Images" },
  { id: "vto", label: "Virtual Try-On", icon: Shirt, highlight: true },
  { id: "ai-video", label: "AI Video", icon: Video, highlight: true },
  { id: "3d", label: "3D Product", icon: Box },
];

export default function AddProductPage() {
  const [activeTab, setActiveTab] = useState("basic");

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      <div className="flex items-center gap-4">
        <Link href="/products" className="p-2 bg-surface hover:bg-surface-hover border border-border rounded-md transition-colors text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Add New Product</h1>
          <p className="text-sm text-muted-foreground">Create a new product listing with AI-enhanced media.</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <button className="px-4 py-2 bg-background border border-border hover:bg-surface-hover rounded-md text-sm font-medium transition-colors">
            Save Draft
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-accent-foreground rounded-md text-sm font-medium transition-colors shadow-[0_0_15px_rgba(212,175,55,0.2)]">
            <Save className="w-4 h-4" />
            Publish Product
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="w-full lg:w-64 flex-shrink-0">
          <div className="bg-surface border border-border rounded-xl p-2 sticky top-24">
            <nav className="space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg transition-colors",
                    activeTab === tab.id
                      ? "bg-accent/10 text-accent"
                      : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                  )}
                >
                  <div className="flex items-center gap-3">
                    {tab.icon && <tab.icon className="w-4 h-4" />}
                    {tab.label}
                  </div>
                  {tab.highlight && <Sparkles className="w-3 h-3 text-accent" />}
                </button>
              ))}
            </nav>
          </div>
        </div>

        <div className="flex-1 bg-surface border border-border rounded-xl p-8 min-h-[600px]">
          {activeTab === "basic" && (
            <div className="space-y-6 animate-in fade-in">
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-4">Basic Information</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Product Name</label>
                    <input type="text" placeholder="e.g. Classic Silk Shirt" className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">SKU</label>
                      <input type="text" placeholder="SH-SLK-001" className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">Category</label>
                      <select className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all appearance-none">
                        <option>Shirts & Blouses</option>
                        <option>Dresses</option>
                        <option>Outerwear</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Description</label>
                    <textarea rows={5} placeholder="Describe the product..." className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all resize-none" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "images" && (
            <div className="space-y-6 animate-in fade-in">
              <h2 className="text-lg font-semibold text-foreground mb-4">Product Images</h2>
              <div className="border-2 border-dashed border-border hover:border-accent/50 bg-background/50 rounded-xl p-12 flex flex-col items-center justify-center text-center transition-colors cursor-pointer group">
                <div className="w-16 h-16 bg-surface border border-border rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <ImageIcon className="w-8 h-8 text-muted-foreground group-hover:text-accent transition-colors" />
                </div>
                <h3 className="text-foreground font-medium mb-1">Drag & Drop images here</h3>
                <p className="text-sm text-muted-foreground mb-6">Supports JPG, PNG, WEBP up to 10MB</p>
                <button className="px-4 py-2 bg-surface hover:bg-surface-hover border border-border rounded-md text-sm font-medium transition-colors text-foreground">
                  Browse Files
                </button>
              </div>
              
              <div className="grid grid-cols-4 gap-4 mt-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="aspect-square bg-surface-hover border border-border rounded-lg flex items-center justify-center relative group overflow-hidden">
                    <span className="text-xs text-muted-foreground">Image {i}</span>
                  </div>
                ))}
                <div className="aspect-square bg-background border-2 border-dashed border-border rounded-lg flex items-center justify-center cursor-pointer hover:border-accent transition-colors">
                  <Plus className="w-6 h-6 text-muted-foreground" />
                </div>
              </div>
            </div>
          )}

          {/* Placeholders for complex sections, to be expanded */}
          {activeTab === "vto" && (
             <div className="space-y-6 animate-in fade-in text-center py-20">
                <Shirt className="w-16 h-16 text-accent/50 mx-auto mb-4" />
                <h2 className="text-xl font-semibold">Virtual Try-On Setup</h2>
                <p className="text-muted-foreground max-w-md mx-auto">Upload product reference images to enable the Virtual Try-On feature for customers.</p>
                <button className="mt-6 px-6 py-2 bg-accent text-accent-foreground rounded-md font-medium">Enable Feature</button>
             </div>
          )}

          {activeTab === "ai-video" && (
             <AiVideoGenerator />
          )}
        </div>
      </div>
    </div>
  );
}
