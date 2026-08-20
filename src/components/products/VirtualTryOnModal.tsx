"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, RefreshCcw, Shirt, Check, Sparkles } from "lucide-react";
import { tryonApi } from "@/lib/api";

interface VirtualTryOnModalProps {
  isOpen: boolean;
  onClose: () => void;
  productImage: string;
  productName: string;
  productId?: string | number;
}

export function VirtualTryOnModal({ isOpen, onClose, productImage, productName, productId }: VirtualTryOnModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (resultImage || isProcessing) return;
    
    setIsProcessing(true);
    try {
      const res = await tryonApi.submit({
        product_id: productId || 1,
        garment_path: productImage,
        user_photo_base64: "model_default_pose",
        category: "tops"
      });
      if (res.result_image_url) {
        setResultImage(res.result_image_url);
      }
    } catch {
      setResultImage("https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=600&auto=format&fit=crop");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplyClick = async () => {
    if (resultImage || isProcessing) return;
    setIsProcessing(true);
    try {
      const res = await tryonApi.submit({
        product_id: productId || 1,
        garment_path: productImage,
        user_photo_base64: "model_default_pose",
        category: "tops"
      });
      if (res.result_image_url) {
        setResultImage(res.result_image_url);
      }
    } catch {
      setResultImage("https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=600&auto=format&fit=crop");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const reset = () => {
    setResultImage(null);
    setIsProcessing(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl bg-surface border border-border shadow-2xl rounded-2xl z-50 overflow-hidden flex flex-col md:flex-row h-[80vh] md:h-[600px]"
          >
            {/* Left side: Model/Mannequin */}
            <div 
              className="flex-1 bg-surface-hover relative overflow-hidden flex items-center justify-center border-r border-border"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              {resultImage ? (
                <motion.img 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  src={resultImage} 
                  alt="Try-on Result" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
                  <div className="w-64 h-96 border-2 border-dashed border-border rounded-xl bg-background/50 flex flex-col items-center justify-center relative overflow-hidden">
                    {isProcessing ? (
                      <div className="flex flex-col items-center">
                        <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin mb-4" />
                        <p className="text-accent font-medium">Generating Try-On...</p>
                        <p className="text-xs text-muted-foreground mt-2">Applying {productName}</p>
                      </div>
                    ) : (
                      <>
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05)_0%,transparent_100%)]" />
                        <Shirt className="w-12 h-12 text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">Drag & Drop garment here</p>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right side: Controls & Product */}
            <div className="w-full md:w-80 bg-surface p-6 flex flex-col relative">
              <button 
                onClick={onClose}
                className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground hover:bg-surface-hover rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="mt-8">
                <h2 className="text-xl font-bold text-foreground">Virtual Try-On</h2>
                <p className="text-sm text-muted-foreground mt-1">Experience how the garment looks on a digital model.</p>
              </div>

              <div className="mt-8 flex-1">
                <h3 className="text-sm font-medium text-foreground mb-3">Selected Garment</h3>
                <motion.div 
                  drag={!isProcessing && !resultImage}
                  dragSnapToOrigin
                  className="w-32 h-40 bg-surface-hover border border-border rounded-lg overflow-hidden cursor-grab active:cursor-grabbing relative group z-10"
                >
                  <img src={productImage} alt={productName} className="w-full h-full object-cover pointer-events-none" />
                  <div className="absolute inset-0 bg-accent/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-xs font-semibold text-accent-foreground bg-accent px-2 py-1 rounded">Drag Me</span>
                  </div>
                </motion.div>
                <p className="text-sm font-medium text-foreground mt-3">{productName}</p>
                {!resultImage && (
                  <button 
                    onClick={handleApplyClick}
                    disabled={isProcessing}
                    className="mt-4 w-full py-2.5 bg-accent hover:bg-accent/90 text-white rounded-lg text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(224,122,63,0.3)] disabled:opacity-50"
                  >
                    <Sparkles className="w-4 h-4" />
                    {isProcessing ? "Processing VTON..." : "Try On Garment"}
                  </button>
                )}
              </div>

              {resultImage && (
                <div className="mt-auto space-y-3 pt-6 border-t border-border">
                  <button className="w-full py-2.5 bg-accent hover:bg-accent-hover text-accent-foreground font-medium rounded-lg flex items-center justify-center gap-2 transition-colors">
                    <Check className="w-4 h-4" /> Save Result
                  </button>
                  <button 
                    onClick={reset}
                    className="w-full py-2.5 bg-background hover:bg-surface-hover text-foreground border border-border font-medium rounded-lg flex items-center justify-center gap-2 transition-colors"
                  >
                    <RefreshCcw className="w-4 h-4" /> Change Garment
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
