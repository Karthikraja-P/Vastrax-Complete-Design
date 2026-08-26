"use client";

import { useEffect } from "react";
import { X, ExternalLink, Sparkles, ShoppingBag } from "lucide-react";
import { GarmentViewer3D } from "./GarmentViewer3D";
import Link from "next/link";

interface Product3DModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: {
    id: string | number;
    name: string;
    category?: string;
    price: number;
    image?: string;
    model3dUrl?: string;
  } | null;
  onAddToBag?: (product: any) => void;
}

export function Product3DModal({
  isOpen,
  onClose,
  product,
  onAddToBag,
}: Product3DModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !product) return null;

  const modelUrl = product.model3dUrl || "/models/3d/garment2_textured.glb";

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6 md:p-10 animate-fade-in">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-4xl h-[85vh] max-h-[750px] bg-[#0c0f17] border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col z-10">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black/40 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#38bdf8]/10 border border-[#38bdf8]/30 flex items-center justify-center text-[#38bdf8]">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-tight">{product.name}</h2>
              <span className="text-xs text-white/50">{product.category || "Luxury Apparel"} • ₹{product.price.toLocaleString()}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={`/storefront/product?id=${product.id}`}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-all"
            >
              <span>Full Details</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 3D Canvas Area */}
        <div className="flex-1 relative w-full h-full">
          <GarmentViewer3D
            src={modelUrl}
            alt={product.name}
            poster={product.image}
            badgeTitle="Hunyuan3D-2.1 Neural Mesh"
            className="w-full h-full rounded-none"
          />
        </div>

        {/* Footer Quick Action */}
        <div className="px-6 py-3.5 border-t border-white/10 bg-black/40 backdrop-blur-md flex items-center justify-between">
          <span className="text-xs text-white/50">
            Interactive 3D Preview powered by Hunyuan3D-2.1
          </span>
          <div className="flex items-center gap-3">
            <Link
              href={`/storefront/product/${product.id}/tryon`}
              className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-all flex items-center gap-2"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#e07a3f]" />
              <span>Virtual Try-On</span>
            </Link>
            {onAddToBag && (
              <button
                onClick={() => {
                  onAddToBag(product);
                  onClose();
                }}
                className="px-5 py-2 rounded-full bg-[#e07a3f] hover:bg-[#cf692e] text-white text-xs font-semibold transition-all flex items-center gap-2 shadow-lg cursor-pointer"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Add to Bag</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
