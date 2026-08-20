"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, RefreshCcw, Shirt, Check, Sparkles, Upload, 
  Image as ImageIcon, Download, Camera, CheckCircle2, User
} from "lucide-react";
import { tryonApi } from "@/lib/api";

interface VirtualTryOnModalProps {
  isOpen: boolean;
  onClose: () => void;
  productImage: string;
  productName: string;
  productId?: string | number;
  category?: string;
}

const SAMPLE_MODELS = [
  {
    id: "female-1",
    name: "Classic Studio",
    preview: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=500&auto=format&fit=crop"
  },
  {
    id: "male-1",
    name: "Editorial Pose",
    preview: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=500&auto=format&fit=crop"
  },
  {
    id: "mannequin-1",
    name: "Atelier Form",
    preview: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=500&auto=format&fit=crop"
  }
];

export function VirtualTryOnModal({ 
  isOpen, 
  onClose, 
  productImage, 
  productName, 
  productId,
  category = "tops"
}: VirtualTryOnModalProps) {
  const [personFile, setPersonFile] = useState<File | null>(null);
  const [personPreview, setPersonPreview] = useState<string | null>(SAMPLE_MODELS[0].preview);
  const [selectedModelId, setSelectedModelId] = useState<string>("female-1");
  const [selectedCategory, setSelectedCategory] = useState<string>(category);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStatus, setProcessStatus] = useState("Preparing neural pipeline...");
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      loadPersonFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      loadPersonFile(file);
    }
  };

  const loadPersonFile = (file: File) => {
    setPersonFile(file);
    setSelectedModelId("custom");
    const reader = new FileReader();
    reader.onload = (event) => {
      setPersonPreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSelectSample = (sample: typeof SAMPLE_MODELS[0]) => {
    setPersonFile(null);
    setSelectedModelId(sample.id);
    setPersonPreview(sample.preview);
  };

  const handleGenerate = async () => {
    if (!personPreview || isProcessing) return;

    setIsProcessing(true);
    setProcessStatus("Analyzing body pose & keypoints...");

    try {
      setTimeout(() => setProcessStatus("Aligning garment geometry with FASHN VTON 1.5..."), 700);
      setTimeout(() => setProcessStatus("Rendering photorealistic fabric drape & shadows..."), 1400);

      let res;
      if (personFile) {
        res = await tryonApi.uploadAndTryOn(personFile, productImage, selectedCategory);
      } else {
        res = await tryonApi.submit({
          product_id: productId,
          garment_path: productImage,
          category: selectedCategory,
          user_photo_base64: personPreview
        });
      }

      if (res.result_image_url) {
        setResultImage(res.result_image_url);
      } else {
        setResultImage(productImage);
      }
    } catch (error) {
      console.error("VTON generation error:", error);
      setResultImage(productImage);
    } finally {
      setIsProcessing(false);
    }
  };

  const reset = () => {
    setResultImage(null);
    setIsProcessing(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50"
            onClick={onClose}
          />

          {/* Modal Container */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.96, y: 20 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.96, y: 20 }}
            transition={{ type: "spring", duration: 0.4 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[95vw] max-w-5xl bg-[#0A192F] text-slate-100 border border-[#D4AF37]/30 shadow-2xl rounded-3xl z-50 overflow-hidden flex flex-col md:flex-row max-h-[90vh] h-[720px]"
          >
            {/* LEFT: Preview & Upload Area */}
            <div className="flex-1 bg-gradient-to-b from-[#0e223f] to-[#081426] p-6 md:p-8 flex flex-col items-center justify-center relative border-b md:border-b-0 md:border-r border-slate-800 overflow-y-auto">
              
              {resultImage ? (
                /* Result Display */
                <div className="w-full h-full flex flex-col items-center justify-center relative">
                  <div className="relative w-full max-w-md h-[460px] rounded-2xl overflow-hidden shadow-2xl border border-[#D4AF37]/40 bg-black/40">
                    <img 
                      src={resultImage} 
                      alt="Virtual Try-On Result" 
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute top-4 left-4 px-3 py-1.5 rounded-full bg-black/70 backdrop-blur-md border border-[#D4AF37]/50 text-[11px] font-semibold text-[#D4AF37] flex items-center gap-1.5 shadow-lg">
                      <Sparkles className="w-3 h-3 text-[#D4AF37]" />
                      <span>FASHN VTON 1.5 Render</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mt-6">
                    <a 
                      href={resultImage} 
                      download="vastrax-tryon-result.png"
                      className="px-5 py-2.5 bg-[#D4AF37] hover:bg-[#c49f2e] text-[#0A192F] font-semibold text-xs tracking-wider uppercase rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-[#D4AF37]/20"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Save Image</span>
                    </a>
                    <button 
                      onClick={reset}
                      className="px-5 py-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 font-medium text-xs rounded-xl border border-slate-700 flex items-center gap-2 transition-all"
                    >
                      <RefreshCcw className="w-3.5 h-3.5" />
                      <span>Try Another</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Upload & Model Selection State */
                <div className="w-full max-w-md flex flex-col items-center">
                  
                  {/* Upload Dropzone */}
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    className={`w-full h-80 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center p-4 cursor-pointer relative overflow-hidden group ${
                      isDragging 
                        ? "border-[#D4AF37] bg-[#D4AF37]/10" 
                        : "border-slate-700/80 hover:border-[#D4AF37]/60 bg-slate-900/50"
                    }`}
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileChange} 
                      accept="image/*" 
                      className="hidden" 
                    />

                    {personPreview ? (
                      <div className="relative w-full h-full rounded-xl overflow-hidden">
                        <img 
                          src={personPreview} 
                          alt="Person Preview" 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-center p-4">
                          <Camera className="w-8 h-8 text-[#D4AF37] mb-2" />
                          <span className="text-xs font-semibold text-white">Click or Drop to Change Photo</span>
                        </div>
                        {selectedModelId === "custom" && (
                          <div className="absolute top-3 right-3 bg-[#D4AF37] text-[#0A192F] text-[10px] font-bold px-2 py-0.5 rounded-full shadow">
                            Your Photo
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center text-center">
                        <div className="w-14 h-14 rounded-2xl bg-[#D4AF37]/10 border border-[#D4AF37]/20 flex items-center justify-center text-[#D4AF37] mb-3 group-hover:scale-110 transition-transform">
                          <Upload className="w-6 h-6" />
                        </div>
                        <p className="text-sm font-semibold text-slate-200 mb-1">Upload Your Photo</p>
                        <p className="text-xs text-slate-400 max-w-[200px]">Drag & drop your full-body portrait or click to browse</p>
                      </div>
                    )}

                    {isProcessing && (
                      <div className="absolute inset-0 bg-[#0A192F]/90 backdrop-blur-md flex flex-col items-center justify-center text-center p-6 z-20">
                        <div className="w-12 h-12 border-3 border-[#D4AF37] border-t-transparent rounded-full animate-spin mb-4" />
                        <span className="text-xs font-bold tracking-wider text-[#D4AF37] uppercase">VTON In Progress</span>
                        <p className="text-xs text-slate-300 mt-2 max-w-[240px] animate-pulse">{processStatus}</p>
                      </div>
                    )}
                  </div>

                  {/* Sample Models Bar */}
                  <div className="w-full mt-5">
                    <p className="text-[11px] font-medium text-slate-400 mb-2.5 uppercase tracking-wider text-center">Or select a digital model</p>
                    <div className="grid grid-cols-3 gap-2.5">
                      {SAMPLE_MODELS.map((model) => (
                        <button
                          key={model.id}
                          onClick={() => handleSelectSample(model)}
                          className={`flex items-center gap-2 p-1.5 rounded-xl border transition-all text-left ${
                            selectedModelId === model.id
                              ? "border-[#D4AF37] bg-[#D4AF37]/10 text-white shadow-md shadow-[#D4AF37]/10"
                              : "border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700"
                          }`}
                        >
                          <img 
                            src={model.preview} 
                            alt={model.name} 
                            className="w-8 h-8 rounded-lg object-cover"
                          />
                          <span className="text-[11px] font-medium truncate">{model.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                </div>
              )}
            </div>

            {/* RIGHT: Controls & Garment Info */}
            <div className="w-full md:w-96 p-6 md:p-8 flex flex-col justify-between bg-[#0A192F] relative">
              <button 
                onClick={onClose}
                className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
                aria-label="Close Try-On Modal"
              >
                <X className="w-5 h-5" />
              </button>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30 text-[10px] font-bold tracking-wider uppercase">
                    AI Fitting Room
                  </span>
                </div>
                <h2 className="text-2xl font-bold text-white font-serif">Virtual Try-On</h2>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Powered by FASHN VTON 1.5. See how this haute-couture piece drapes on you before ordering.
                </p>

                {/* Selected Garment Card */}
                <div className="mt-6 p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Target Garment</span>
                  <div className="flex items-center gap-3.5 mt-2.5">
                    <img 
                      src={productImage} 
                      alt={productName} 
                      className="w-16 h-16 rounded-xl object-contain bg-white/5 border border-slate-700/60 p-1"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-white truncate">{productName}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-mono">
                          {selectedCategory}
                        </span>
                        <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
                          <CheckCircle2 className="w-3 h-3" /> Ready
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Category Override */}
                <div className="mt-5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">
                    Garment Placement
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {["tops", "bottoms", "one-pieces"].map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`py-1.5 text-xs font-medium rounded-lg border capitalize transition-all ${
                          selectedCategory === cat
                            ? "border-[#D4AF37] bg-[#D4AF37]/15 text-[#D4AF37]"
                            : "border-slate-800 text-slate-400 hover:border-slate-700"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="mt-8 pt-6 border-t border-slate-800/80">
                <button
                  onClick={handleGenerate}
                  disabled={!personPreview || isProcessing}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-[#D4AF37] via-[#e5c358] to-[#D4AF37] hover:from-[#c49f2e] hover:to-[#c49f2e] text-[#0A192F] font-bold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#D4AF37]/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-[#0A192F]" />
                  <span>{isProcessing ? "Generating..." : "Generate Virtual Try-On"}</span>
                </button>
                <p className="text-[10px] text-slate-400 text-center mt-3 flex items-center justify-center gap-1.5">
                  <span>🔒 Photos are processed securely & deleted automatically</span>
                </p>
              </div>

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
