"use client";

import React, { useState, useRef } from "react";
import { 
  Home, ChevronRight, Plus, Sparkles, Image as ImageIcon, Send, Link, 
  Bold, Italic, Underline, List, AlignLeft, Type, Check, ChevronDown
} from "lucide-react";

export default function CreateProductPage() {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

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
        <span className="text-foreground">Create New Product</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Create New Product</h1>
        <div className="flex items-center gap-3">
          <button className="px-5 py-2 rounded-full border border-accent text-accent font-medium text-sm hover:bg-accent/10 transition-colors shadow-[0_0_15px_rgba(224,122,63,0.1)]">
            Add your API key for the demo
          </button>
          <button className="px-5 py-2 rounded-full bg-background border border-border hover:bg-surface-hover text-foreground font-medium text-sm transition-colors">
            Cancel
          </button>
          <button className="px-5 py-2 rounded-full bg-accent hover:bg-accent/90 text-white font-medium text-sm transition-colors shadow-[0_0_15px_rgba(224,122,63,0.3)]">
            Create Product
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
                {uploadedImage && (
                  <div className="w-12 h-12 rounded-lg border-2 border-accent bg-[#2a383d] flex items-center justify-center relative shadow-[0_0_10px_rgba(224,122,63,0.2)] overflow-hidden">
                    <div className="w-2 h-2 rounded-full bg-accent absolute -top-1 -left-1 z-10"></div>
                    <img src={uploadedImage} alt="Thumbnail" className="w-full h-full object-cover" />
                  </div>
                )}
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-12 h-12 rounded-lg border border-white/10 bg-black/40 hover:bg-white/5 flex flex-col items-center justify-center cursor-pointer transition-colors text-muted-foreground"
                >
                  <Plus className="w-4 h-4 mb-0.5" />
                  <span className="text-[9px] font-medium">Add</span>
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleImageUpload} 
                  accept="image/*" 
                  className="hidden" 
                />
              </div>
              
              <div className="absolute bottom-4 right-4 text-xs font-medium text-muted-foreground bg-black/40 px-2 py-1 rounded-md">
                {uploadedImage ? "1/12" : "0/12"}
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
                <input type="text" placeholder="Enter product name" className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-white placeholder:text-muted-foreground/50" />
              </div>

              {/* Description */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-white">Description</label>
                <textarea rows={3} placeholder="Enter product description" className="w-full px-4 py-3 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-white placeholder:text-muted-foreground/50 resize-none" />
              </div>

              {/* Full Description (Rich Text Mock) */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-white">Full Description</label>
                
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
                  <div className="p-4 text-sm text-muted-foreground/50 min-h-[120px] focus:outline-none" contentEditable suppressContentEditableWarning>
                    Write the full product description shown on the product page
                  </div>
                </div>
              </div>

              {/* SKU and Slug */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-white">SKU <span className="text-red-500">*</span></label>
                  <input type="text" placeholder="Enter SKU code" className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-white placeholder:text-muted-foreground/50" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-white">URL Slug</label>
                  <input type="text" placeholder="product-url-slug" className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-white placeholder:text-muted-foreground/50" />
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
            <div className="p-5 flex items-center justify-center">
              <div className="p-6 text-center border border-white/5 border-dashed rounded-lg bg-background/50 w-full">
                <p className="text-sm text-muted-foreground">No options yet. Add colours or sizes so customers can choose on the product page.</p>
              </div>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN - 1/3 Width */}
        <div className="space-y-6">
          
          {/* Preview Panel */}
          <div className="bg-surface border border-border rounded-xl p-5 aspect-[4/5] flex flex-col items-center relative overflow-hidden">
            {uploadedImage ? (
              <div className="w-full h-full flex flex-col">
                <div className="flex items-center justify-between mb-4 relative z-10">
                  <div>
                    <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Preview</h3>
                    <h2 className="text-sm font-bold text-white">Main photo</h2>
                  </div>
                </div>
                <div className="flex-1 w-full bg-black/40 rounded-xl flex items-center justify-center border border-white/5 overflow-hidden">
                  <img src={uploadedImage} alt="Product Preview" className="w-full h-full object-cover" />
                </div>
              </div>
            ) : (
              <>
                <div className="w-full flex items-center justify-between mb-16 relative z-10">
                  <div>
                    <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Preview</h3>
                    <h2 className="text-sm font-bold text-white">Nothing to show yet</h2>
                  </div>
                </div>
                
                <div className="relative z-10 flex flex-col items-center justify-center text-center px-4 w-full h-full flex-1 mb-12">
                  <div className="flex gap-2 justify-center mb-6">
                     {/* Fake little thumbnails mimicking the UI */}
                     <div className="w-12 h-12 rounded-lg bg-orange-950/40 border border-white/10 flex items-center justify-center text-orange-500 shadow-xl opacity-70"><ImageIcon className="w-5 h-5"/></div>
                     <div className="w-12 h-12 rounded-lg bg-amber-950/40 border border-white/10 flex items-center justify-center text-amber-500 shadow-xl scale-110 z-10"><ImageIcon className="w-5 h-5"/></div>
                     <div className="w-12 h-12 rounded-lg bg-stone-900/60 border border-white/10 flex items-center justify-center text-stone-400 shadow-xl opacity-80"><ImageIcon className="w-5 h-5"/></div>
                     <div className="w-12 h-12 rounded-lg bg-orange-900/30 border border-white/10 flex items-center justify-center text-orange-700 shadow-xl opacity-60"><ImageIcon className="w-5 h-5"/></div>
                  </div>
                  <h2 className="text-xl font-bold text-white mb-2 leading-tight">Start creating with AI<br/>Product Studio</h2>
                  <p className="text-xs text-muted-foreground">Write a prompt below, or drop in your own photos.</p>
                </div>
              </>
            )}
          </div>

          {/* Pricing & Inventory */}
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
             <div className="p-4 border-b border-white/5">
              <h2 className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Pricing & Inventory</h2>
            </div>
            <div className="p-5 grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-white">Price <span className="text-red-500">*</span></label>
                <input type="text" placeholder="0.00" className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-white placeholder:text-muted-foreground/50" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-white">Compare at Price</label>
                <input type="text" placeholder="0.00" className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-white placeholder:text-muted-foreground/50" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-white">Cost Price</label>
                <input type="text" placeholder="0.00" className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-white placeholder:text-muted-foreground/50" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-white">Stock Quantity</label>
                <input type="text" placeholder="0" className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-white placeholder:text-muted-foreground/50" />
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
                  <select defaultValue="" className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent text-white appearance-none cursor-pointer">
                    <option value="" disabled>Select category</option>
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

              <label className="flex items-start gap-3 p-3 rounded-lg bg-background border border-white/5 cursor-pointer group hover:bg-[#1a1a1a] transition-colors">
                <div className="relative flex items-center justify-center w-5 h-5 rounded bg-[#1a1a1a] border border-white/20 mt-0.5 group-hover:border-white/40 transition-colors">
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
