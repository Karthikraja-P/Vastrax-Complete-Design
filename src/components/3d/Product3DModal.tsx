"use client";

import { useEffect } from "react";
import Image from "next/image";
import { X, ExternalLink, Sparkles, ShoppingBag } from "lucide-react";
import { GarmentViewer3D } from "./GarmentViewer3D";
import Link from "next/link";

interface ModalProduct {
  id: string | number;
  name: string;
  category?: string;
  price: number;
  image?: string;
  model3dUrl?: string;
}

export interface AddToCartProduct {
  id: string | number;
  name: string;
  price: number;
  image?: string;
  colour?: string;
}

const GENERIC_MODEL_FILES = new Set([
  "garment_perfect.glb",
  "garment2_textured.glb",
  "textured_garment.glb",
  "garment_photo_textured.glb",
]);

function getProductModelUrl(url?: string) {
  if (!url) return undefined;
  const filename = url.split(/[?#]/, 1)[0].split("/").pop()?.toLowerCase();
  return filename && GENERIC_MODEL_FILES.has(filename) ? undefined : url;
}

interface Product3DModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: ModalProduct | null;
  onAddToBag?: (product: ModalProduct) => void;
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

  const modelUrl = getProductModelUrl(product.model3dUrl);

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
            {product.id !== "preview" && (
              <Link
                href={`/storefront/product?id=${product.id}`}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-all"
              >
                <span>Full Details</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            )}
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 3D Canvas Area */}
        <div className="flex-1 relative w-full min-h-0">
          {modelUrl ? (
            <GarmentViewer3D
              src={modelUrl}
              alt={product.name}
              poster={product.image}
              badgeTitle="Garment Preview"
              showBadge={false}
              showInteractionHint={false}
              className="w-full h-full rounded-none"
            />
          ) : (
            <div className="relative flex h-full w-full items-center justify-center bg-[#10141d]">
              {product.image ? (
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  unoptimized
                  className="object-contain p-6"
                />
              ) : (
                <div className="text-sm text-white/60">No product image available</div>
              )}
              <div className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-black/75 px-4 py-2 text-xs text-white/80 backdrop-blur">
                A product-specific 3D preview is not available yet.
              </div>
            </div>
          )}
        </div>

        {/* Footer Quick Action */}
        <div className="px-6 py-3.5 border-t border-white/10 bg-black/40 backdrop-blur-md flex items-center justify-between">
          <span />
          <div className="flex items-center gap-3">

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
