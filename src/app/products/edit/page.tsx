"use client";

import React, { useState } from "react";
import { 
  Home, ChevronRight, Plus, Sparkles, Image as ImageIcon, Send, Link, 
  Bold, Italic, Underline, List, AlignLeft, Upload, Edit3, Type,
  Tags, ChevronDown, Check
} from "lucide-react";

export default function EditProductPage() {
  const [activeLang, setActiveLang] = useState<"en" | "ar">("en");
  
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-24">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Home className="w-3 h-3" />
        <ChevronRight className="w-3 h-3" />
        <span className="cursor-pointer hover:text-foreground transition-colors">Dashboard</span>
        <ChevronRight className="w-3 h-3" />
        <span className="cursor-pointer hover:text-foreground transition-colors">Products</span>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground">Edit Product</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Teal Five-Panel Cap</h1>
        <div className="flex items-center gap-3">
          <button className="px-5 py-2 rounded-full border border-accent text-accent font-medium text-sm hover:bg-accent/10 transition-colors shadow-[0_0_15px_rgba(224,122,63,0.1)]">
            Add your API key for the demo
          </button>
          <button className="px-5 py-2 rounded-full bg-background border border-border hover:bg-surface-hover text-foreground font-medium text-sm transition-colors">
            Cancel
          </button>
          <button className="px-5 py-2 rounded-full bg-accent hover:bg-accent/90 text-white font-medium text-sm transition-colors shadow-[0_0_15px_rgba(224,122,63,0.3)]">
            Update Product
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        
        {/* LEFT COLUMN - 2/3 Width */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* AI Media Area */}
          <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
            <div className="bg-[#111] rounded-lg aspect-video flex flex-col items-center justify-center border border-white/5 relative overflow-hidden group">
              {/* Fake AI spark */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -mt-8">
                <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center mb-4 mx-auto border border-white/10">
                  <Sparkles className="w-5 h-5 text-accent" />
                </div>
                <h3 className="text-white font-bold text-lg text-center mb-1">Ask for anything about this product</h3>
                <p className="text-muted-foreground text-xs text-center max-w-sm">Write the details, cut a background out, or photograph it on a model. Say what you want in your own words.</p>
              </div>

              {/* Bottom left thumbnails */}
              <div className="absolute bottom-4 left-4 flex gap-2">
                <div className="w-12 h-12 rounded-lg border-2 border-accent bg-[#2a383d] flex items-center justify-center relative shadow-[0_0_10px_rgba(224,122,63,0.2)]">
                  <div className="w-2 h-2 rounded-full bg-accent absolute -top-1 -left-1"></div>
                  <ImageIcon className="w-5 h-5 text-white/50" />
                </div>
                <div className="w-12 h-12 rounded-lg border border-white/10 bg-black/40 hover:bg-white/5 flex flex-col items-center justify-center cursor-pointer transition-colors text-muted-foreground">
                  <Plus className="w-4 h-4 mb-0.5" />
                  <span className="text-[9px] font-medium">Add</span>
                </div>
              </div>
              
              <div className="absolute bottom-4 right-4 text-xs font-medium text-muted-foreground bg-black/40 px-2 py-1 rounded-md">
                1/12
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <span className="px-3 py-1.5 rounded-full border border-white/10 bg-[#1a1a1a] text-xs font-medium text-muted-foreground hover:text-white hover:bg-white/5 cursor-pointer transition-colors">Write the product details</span>
              <span className="px-3 py-1.5 rounded-full border border-white/10 bg-[#1a1a1a] text-xs font-medium text-muted-foreground hover:text-white hover:bg-white/5 cursor-pointer transition-colors">Clean white studio shot</span>
              <span className="px-3 py-1.5 rounded-full border border-white/10 bg-[#1a1a1a] text-xs font-medium text-muted-foreground hover:text-white hover:bg-white/5 cursor-pointer transition-colors">Photograph this on a model</span>
            </div>

            <div className="bg-[#111] border border-white/10 rounded-xl p-3 flex flex-col gap-3">
              <input type="text" placeholder="Ask for anything: write the details, remove a background, put it on a model." className="bg-transparent border-none focus:outline-none text-sm text-white placeholder:text-muted-foreground/60 w-full px-2" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 text-white text-xs font-medium">
                    <Sparkles className="w-3 h-3 text-accent" /> Assistant
                  </button>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-white/5 text-muted-foreground text-xs font-medium transition-colors">
                    <ImageIcon className="w-3 h-3" /> Animate
                  </button>
                </div>
                <button className="w-8 h-8 rounded-full bg-accent hover:bg-accent/90 flex items-center justify-center text-white transition-colors shadow-[0_0_10px_rgba(224,122,63,0.3)]">
                  <Send className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          {/* Basic Information Panel */}
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="p-4 border-b border-white/5">
              <h2 className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Basic Information</h2>
            </div>
            
            <div className="p-5 space-y-5">
              {/* Product Name */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-white">Product Name <span className="text-red-500">*</span></label>
                <div className="flex border-b border-white/10">
                  <button 
                    onClick={() => setActiveLang("en")}
                    className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${activeLang === "en" ? "border-accent text-accent" : "border-transparent text-muted-foreground hover:text-white"}`}
                  >
                    English
                  </button>
                  <button 
                    onClick={() => setActiveLang("ar")}
                    className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${activeLang === "ar" ? "border-accent text-accent" : "border-transparent text-muted-foreground hover:text-white"}`}
                  >
                    عربي
                  </button>
                </div>
                <input type="text" defaultValue="Teal Five-Panel Cap" className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-white" />
              </div>

              {/* Description */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-white">Description</label>
                <div className="flex border-b border-white/10">
                  <button 
                    onClick={() => setActiveLang("en")}
                    className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${activeLang === "en" ? "border-accent text-accent" : "border-transparent text-muted-foreground hover:text-white"}`}
                  >
                    English
                  </button>
                  <button 
                    onClick={() => setActiveLang("ar")}
                    className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${activeLang === "ar" ? "border-accent text-accent" : "border-transparent text-muted-foreground hover:text-white"}`}
                  >
                    عربي
                  </button>
                </div>
                <textarea rows={3} defaultValue="Low-profile five-panel cap in deep teal cotton, with a flat brim and a woven adjuster strap." className="w-full px-4 py-3 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-white resize-none" />
              </div>

              {/* Full Description (Rich Text Mock) */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-white">Full Description</label>
                <div className="flex border-b border-white/10">
                  <button className="px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 border-accent text-accent">English</button>
                  <button className="px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 border-transparent text-muted-foreground">عربي</button>
                </div>
                
                <div className="border border-border rounded-lg bg-background overflow-hidden">
                  <div className="flex items-center gap-1 p-2 border-b border-white/5 bg-[#1a1a1a]">
                    <select className="bg-transparent border-none text-xs text-white focus:outline-none cursor-pointer px-2">
                      <option>Normal</option>
                      <option>Heading 1</option>
                      <option>Heading 2</option>
                    </select>
                    <div className="w-px h-4 bg-white/10 mx-1"></div>
                    <button className="p-1.5 rounded hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"><Bold className="w-3.5 h-3.5" /></button>
                    <button className="p-1.5 rounded hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"><Italic className="w-3.5 h-3.5" /></button>
                    <button className="p-1.5 rounded hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"><Underline className="w-3.5 h-3.5" /></button>
                    <div className="w-px h-4 bg-white/10 mx-1"></div>
                    <button className="p-1.5 rounded hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"><List className="w-3.5 h-3.5" /></button>
                    <button className="p-1.5 rounded hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"><AlignLeft className="w-3.5 h-3.5" /></button>
                    <div className="w-px h-4 bg-white/10 mx-1"></div>
                    <button className="p-1.5 rounded hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"><Link className="w-3.5 h-3.5" /></button>
                    <button className="p-1.5 rounded hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"><Type className="w-3.5 h-3.5" /></button>
                  </div>
                  <div className="p-4 text-sm text-white min-h-[120px] focus:outline-none" contentEditable suppressContentEditableWarning>
                    Low-profile five-panel cap in deep teal cotton, with a flat brim and a woven adjuster strap.<br/><br/>
                    Benefits<br/><br/>
                    Product Details<br/><br/>
                    Care Instructions
                  </div>
                </div>
              </div>

              {/* SKU and Slug */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-white">SKU <span className="text-red-500">*</span></label>
                  <input type="text" defaultValue="HAT-005" className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-white" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-white">URL Slug</label>
                  <input type="text" defaultValue="teal-five-panel-cap" className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-white" />
                </div>
              </div>

            </div>
          </div>

          {/* Options & Variants */}
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <h2 className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Options & Variants</h2>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/10 hover:bg-white/5 text-xs font-medium text-white transition-colors">
                <Plus className="w-3 h-3" /> Add Option
              </button>
            </div>
            <div className="p-5 space-y-3">
              
              <div className="flex items-center justify-between p-3 rounded-lg border border-white/5 bg-background hover:bg-[#1a1a1a] transition-colors cursor-pointer group">
                <div className="flex items-center gap-4">
                  <div className="w-5 h-5 rounded-full bg-black shadow-inner border border-white/10"></div>
                  <div>
                    <p className="text-sm font-bold text-white group-hover:text-accent transition-colors">Black</p>
                    <p className="text-[10px] text-muted-foreground">HAT-005-C-BLACK</p>
                  </div>
                </div>
                <span className="text-sm font-medium text-foreground">5</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border border-white/5 bg-background hover:bg-[#1a1a1a] transition-colors cursor-pointer group">
                <div className="flex items-center gap-4">
                  <div className="w-5 h-5 rounded-full bg-neutral-800 shadow-inner border border-white/10"></div>
                  <div>
                    <p className="text-sm font-bold text-white group-hover:text-accent transition-colors">Charcoal</p>
                    <p className="text-[10px] text-muted-foreground">HAT-005-C-CHARCOAL</p>
                  </div>
                </div>
                <span className="text-sm font-medium text-foreground">15</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border border-white/5 bg-background hover:bg-[#1a1a1a] transition-colors cursor-pointer group">
                <div className="flex items-center gap-4">
                  <div className="w-5 h-5 rounded-full bg-blue-950 shadow-inner border border-white/10"></div>
                  <div>
                    <p className="text-sm font-bold text-white group-hover:text-accent transition-colors">Navy</p>
                    <p className="text-[10px] text-muted-foreground">HAT-005-C-NAVY</p>
                  </div>
                </div>
                <span className="text-sm font-medium text-foreground">5</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border border-white/5 bg-background hover:bg-[#1a1a1a] transition-colors cursor-pointer group">
                <div className="flex items-center gap-4">
                  <div className="w-5 h-5 rounded-full bg-teal-800 shadow-inner border border-white/10 ring-1 ring-accent ring-offset-1 ring-offset-background"></div>
                  <div>
                    <p className="text-sm font-bold text-white group-hover:text-accent transition-colors">Teal</p>
                    <p className="text-[10px] text-muted-foreground">HAT-005-C-TEAL</p>
                  </div>
                </div>
                <span className="text-sm font-medium text-foreground">11</span>
              </div>

            </div>
          </div>

        </div>

        {/* RIGHT COLUMN - 1/3 Width */}
        <div className="space-y-6">
          
          {/* Preview Panel */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Preview</h3>
                <h2 className="text-sm font-bold text-white">Main photo</h2>
              </div>
              <div className="flex gap-2">
                <button className="w-8 h-8 rounded-full border border-white/10 hover:bg-white/5 flex items-center justify-center text-muted-foreground transition-colors"><Edit3 className="w-3.5 h-3.5" /></button>
                <button className="w-8 h-8 rounded-full border border-white/10 hover:bg-white/5 flex items-center justify-center text-muted-foreground transition-colors"><Upload className="w-3.5 h-3.5" /></button>
              </div>
            </div>
            <div className="bg-black/40 rounded-xl aspect-[4/5] flex items-center justify-center border border-white/5">
              {/* Fake preview image container */}
              <div className="w-48 h-32 bg-teal-900/50 rounded-t-[40px] rounded-b-xl relative shadow-2xl opacity-60">
                 <div className="absolute -bottom-2 -left-4 w-56 h-10 bg-teal-800/80 rounded-full blur-[2px]"></div>
              </div>
            </div>
          </div>

          {/* Pricing & Inventory */}
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
             <div className="p-4 border-b border-white/5">
              <h2 className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Pricing & Inventory</h2>
            </div>
            <div className="p-5 grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-white">Price <span className="text-red-500">*</span></label>
                <input type="text" defaultValue="37" className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-white" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-white">Compare at Price</label>
                <input type="text" defaultValue="0.00" className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-white" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-white">Cost Price</label>
                <input type="text" defaultValue="12" className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-white" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-white">Stock Quantity</label>
                <input type="text" defaultValue="130" className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-white" />
              </div>
            </div>
          </div>

          {/* Organization */}
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="p-4 border-b border-white/5">
              <h2 className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Organization</h2>
            </div>
            <div className="p-5 space-y-5">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-white">Category <span className="text-red-500">*</span></label>
                <div className="relative">
                  <select defaultValue="hats" className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-white appearance-none cursor-pointer">
                    <option value="hats">Hats</option>
                    <option value="shoes">Shoes</option>
                    <option value="clothing">Clothing</option>
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-white">Tags</label>
                <div className="relative">
                  <input type="text" placeholder="Add a tag and press Enter" className="w-full pl-4 pr-10 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-white placeholder:text-muted-foreground/50" />
                  <button className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border border-white/10 hover:bg-white/5 flex items-center justify-center text-muted-foreground transition-colors"><Plus className="w-3 h-3" /></button>
                </div>
                {/* Tag Pills */}
                <div className="flex flex-wrap gap-2 pt-2">
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-muted-foreground hover:text-white transition-colors cursor-pointer">
                    hat <X className="w-3 h-3 opacity-50 hover:opacity-100" />
                  </span>
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-muted-foreground hover:text-white transition-colors cursor-pointer">
                    cap <X className="w-3 h-3 opacity-50 hover:opacity-100" />
                  </span>
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-muted-foreground hover:text-white transition-colors cursor-pointer">
                    five-panel <X className="w-3 h-3 opacity-50 hover:opacity-100" />
                  </span>
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-muted-foreground hover:text-white transition-colors cursor-pointer">
                    teal <X className="w-3 h-3 opacity-50 hover:opacity-100" />
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Settings */}
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="p-4 border-b border-white/5">
              <h2 className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Settings</h2>
            </div>
            <div className="p-5 space-y-3">
              
              <label className="flex items-start gap-3 p-3 rounded-lg bg-background border border-white/5 cursor-pointer group">
                <div className="relative flex items-center justify-center w-5 h-5 rounded bg-accent border border-accent mt-0.5">
                  <Check className="w-3 h-3 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Active</p>
                  <p className="text-[10px] text-muted-foreground">Product will be visible in store</p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-lg bg-background border border-white/5 cursor-pointer group">
                <div className="relative flex items-center justify-center w-5 h-5 rounded bg-accent border border-accent mt-0.5">
                  <Check className="w-3 h-3 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Featured</p>
                  <p className="text-[10px] text-muted-foreground">Show on homepage featured section</p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-lg bg-background border border-white/5 cursor-pointer group hover:bg-[#1a1a1a] transition-colors">
                <div className="relative flex items-center justify-center w-5 h-5 rounded bg-[#1a1a1a] border border-white/20 mt-0.5 group-hover:border-white/40 transition-colors">
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Best Seller</p>
                  <p className="text-[10px] text-muted-foreground">Show in the best sellers collection</p>
                </div>
              </label>

            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
