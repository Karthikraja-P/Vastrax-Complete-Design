"use client";

import React, { useState, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  Sparkles, Upload, RefreshCw, Check, ShoppingBag,
  AlertCircle, Layers, X, Camera 
} from "lucide-react";
import { tryonApi, productsApi } from "@/lib/api";
import { useSession } from "next-auth/react";

const PHOTO_TIPS = {
  bottoms: "Avoid wearing a long top, kurti, or dress that covers your legs. Wear shorts or leggings so the AI can drape the pants correctly.",
  tops: "A full-body photo is recommended, but a waist-up (half-pose) photo can also be detected and draped.",
  "dresses": "A full-body pose photo is required to drape the full garment correctly.",
};

const TIP_LABEL = {
  bottoms: "Pants Try-On Guide",
  tops: "Tops Try-On Guide",
  "dresses": "Dress/Kurti Try-On Guide",
};

export default function VirtualTryOnPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { data: session } = useSession();

  const [products, setProducts] = useState<any[]>([]);
  const [product, setProduct] = useState<any>(null);
  
  const [personFile, setPersonFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  const [selectedTop, setSelectedTop] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusType, setStatusType] = useState("");
  const [statusText, setStatusText] = useState("");
  const [tryOnComplete, setTryOnComplete] = useState(false);
  const [tryOnResultUrl, setTryOnResultUrl] = useState("");
  const [addedBag, setAddedBag] = useState(false);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [sizeError, setSizeError] = useState(false);
  const [showGarmentList, setShowGarmentList] = useState(false);
  const [showTipsModal, setShowTipsModal] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const allProducts = await productsApi.list();
        setProducts(allProducts);
        const current = allProducts.find((p: any) => p.id.toString() === id);
        setProduct(current || allProducts[0]);
      } catch (e) {
        console.error("Failed to load products", e);
      }
    }
    loadData();
  }, [id]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const triggerFileInput = () => fileInputRef.current?.click();

  const handlePhotoUpload = (file: File) => {
    if (file && file.type.startsWith("image/")) {
      setPersonFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setPreviewUrl(e.target?.result as string);
      reader.readAsDataURL(file);
      setTryOnComplete(false);
      setStatusType("");
      setStatusText("");
      setShowTipsModal(false);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handlePhotoUpload(e.target.files[0]);
  };
  const onDragOver = (e: React.DragEvent) => e.preventDefault();
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files?.[0]) handlePhotoUpload(e.dataTransfer.files[0]);
  };

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A192F]">
        <div className="flex flex-col items-center gap-4 text-white">
          <RefreshCw className="w-8 h-8 animate-spin text-[#D4AF37]" />
          <p>Loading Garment Data...</p>
        </div>
      </div>
    );
  }

  const getGarmentImage = (p: any) => {
    if (!p) return "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?q=80&w=800&auto=format&fit=crop";
    if (p.image) return p.image;
    if (Array.isArray(p.images) && p.images.length > 0) {
      if (typeof p.images[0] === "string") return p.images[0];
      if (p.images[0]?.s3_url) return p.images[0].s3_url;
    }
    const name = (p.name || p.title || "").toLowerCase();
    if (/frock|dress|gown/i.test(name)) return "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?q=80&w=800&auto=format&fit=crop";
    if (/jacket|coat|outerwear/i.test(name)) return "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=800&auto=format&fit=crop";
    if (/hoodie/i.test(name)) return "https://images.unsplash.com/photo-1556821840-3a63f95609a7?q=80&w=800&auto=format&fit=crop";
    if (/pant|trouser|denim/i.test(name)) return "https://images.unsplash.com/photo-1542272604-787c3835535d?q=80&w=800&auto=format&fit=crop";
    return "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?q=80&w=800&auto=format&fit=crop";
  };

  const getFashnCategory = (cat: string, name: string = "") => {
    const combined = (cat + " " + name).toLowerCase();
    if (combined.includes("pant") || combined.includes("bottom") || combined.includes("denim") || combined.includes("skirt") || combined.includes("trouser")) return "bottoms";
    if (combined.includes("dress") || combined.includes("frock") || combined.includes("gown") || combined.includes("bodycon") || combined.includes("kurti")) return "dresses";
    return "tops";
  };

  const fashnType = getFashnCategory(product.category?.name || product.category || "", product.name || product.title || "");
  const isBottoms = fashnType === "bottoms";
  const availableTops = products.filter(p => getFashnCategory(p.category?.name || p.category || "", p.name || "") === "tops" && String(p.id) !== String(product.id));

  const startTryOnPipeline = async () => {
    if (!personFile || !product) return;

    const isCombo = isBottoms && selectedTop;
    setIsProcessing(true);
    setTryOnComplete(false);
    setStatusType("processing");
    setStatusText(isCombo ? "Running 2-pass outfit drape on GPU... (~30 seconds)" : "Sending to neural pipeline... (~14 seconds)");

    try {
      let res;
      const targetGarmentImg = getGarmentImage(product);
      if (isCombo) {
        const topImg = getGarmentImage(selectedTop);
        res = await tryonApi.submitCombo(personFile, topImg, targetGarmentImg);
      } else {
        res = await tryonApi.submitDirect(personFile, targetGarmentImg, fashnType);
      }

      if (res && res.result_image_url) {
        setTryOnResultUrl(res.result_image_url);
        setTryOnComplete(true);
        setStatusType("success");
        setStatusText(`Done! ${isCombo ? "Full outfit draped" : "Garment draped"}.`);
      } else {
        throw new Error("Try-on response failed.");
      }
    } catch (err: any) {
      setStatusType("error");
      setStatusText(err.message || "Failed to process virtual try-on.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddBag = () => {
    if (!selectedSize) {
      setSizeError(true);
      return;
    }
    const saved = localStorage.getItem("vastrax_cart");
    const currentCart = saved ? JSON.parse(saved) : [];
    currentCart.push({
      id: product.id,
      name: product.name,
      price: product.price_selling || product.price,
      quantity: 1,
      size: selectedSize,
      color: product.colour || "Default",
      image: product.images?.[0]?.s3_url || product.image
    });
    localStorage.setItem("vastrax_cart", JSON.stringify(currentCart));
    setAddedBag(true);
    setTimeout(() => setAddedBag(false), 3000);
  };

  const resetAll = () => {
    setTryOnComplete(false);
    setTryOnResultUrl("");
    setStatusType("");
    setStatusText("");
    setSelectedSize(null);
    setSizeError(false);
  };

  const tips = PHOTO_TIPS[fashnType as keyof typeof PHOTO_TIPS] || PHOTO_TIPS.tops;
  const productImgUrl = getGarmentImage(product);

  return (
    <div className="min-h-screen bg-[#0A192F] text-slate-100 pb-20">
      {/* Header */}
      <header className="px-6 py-6 border-b border-slate-800">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-[#D4AF37] transition-colors"
          >
            ← Back to Product
          </button>
          <div className="text-xl font-serif font-bold text-white tracking-wider flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#D4AF37]" />
            AI FITTING ROOM
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <div className="max-w-[1000px] mx-auto mt-8 px-4 grid grid-cols-1 md:grid-cols-[400px_1fr] gap-8 items-start">
        
        {/* Left Controls */}
        <div className="flex flex-col gap-6">
          
          {/* Step 1 */}
          <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#D4AF37] mb-4">Step 1 — Your Photo</h3>
            <div
              onClick={previewUrl ? triggerFileInput : () => setShowTipsModal(true)}
              onDragOver={onDragOver}
              onDrop={onDrop}
              className={`w-full min-h-[200px] border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-4 cursor-pointer transition-all ${
                previewUrl ? "border-[#D4AF37]/50 bg-black/40" : "border-slate-700 hover:border-[#D4AF37] bg-black/20"
              }`}
            >
              <input type="file" ref={fileInputRef} onChange={onFileChange} accept="image/*" className="hidden" />
              {previewUrl ? (
                <img src={previewUrl} alt="Portrait" className="max-h-[220px] object-contain rounded-lg" />
              ) : (
                <div className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-full bg-[#D4AF37]/20 flex items-center justify-center mb-3">
                    <Camera className="w-5 h-5 text-[#D4AF37]" />
                  </div>
                  <strong className="text-sm text-slate-200">Upload your photo</strong>
                  <p className="text-xs text-slate-400 mt-1">Drag & drop or click to choose</p>
                  <p className="text-[10px] text-slate-500 mt-1">JPG, PNG — up to 10 MB</p>
                </div>
              )}
            </div>
          </div>

          {/* Step 2 */}
          <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl relative">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#D4AF37]">Step 2 — Garment Selected</h3>
              <button 
                onClick={() => setShowGarmentList(!showGarmentList)}
                className="text-[10px] font-bold uppercase text-slate-400 hover:text-white"
              >
                {showGarmentList ? "Hide List ▴" : "Change Garment ▾"}
              </button>
            </div>

            {showGarmentList && (
              <div className="absolute top-14 right-6 w-[280px] max-h-[300px] overflow-y-auto bg-[#0f2341] border border-[#D4AF37]/30 rounded-xl shadow-2xl z-20 p-2 flex flex-col gap-2">
                {products.map(p => {
                  const pImg = p.images?.[0]?.s3_url || p.image;
                  const isSelected = p.id === product.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        router.push(`/storefront/product/${p.id}/tryon`);
                        resetAll();
                        setShowGarmentList(false);
                      }}
                      className={`flex items-center gap-3 p-2 rounded-lg transition-colors text-left ${
                        isSelected ? "bg-[#D4AF37]/20 border border-[#D4AF37]" : "hover:bg-white/5 border border-transparent"
                      }`}
                    >
                      <img src={pImg} alt={p.name} className="w-10 h-12 object-cover rounded bg-white" />
                      <div>
                        <p className="text-xs font-semibold text-white truncate max-w-[180px]">{p.name}</p>
                        <p className="text-[10px] text-slate-400">₹{(p.price_selling || p.price)?.toLocaleString()}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex gap-4 items-center">
              <img src={productImgUrl} alt={product.name} className="w-20 h-24 object-cover rounded-lg border border-slate-700 bg-white" />
              <div>
                <h4 className="text-sm font-semibold text-white">{product.name}</h4>
                <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 mt-1 inline-block">
                  {fashnType}
                </span>
                <p className="text-sm font-bold text-[#D4AF37] mt-1">₹{(product.price_selling || product.price)?.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Step 3 (Combos for bottoms) */}
          {isBottoms && (
            <div className={`bg-slate-900/50 border ${selectedTop ? 'border-[#D4AF37]' : 'border-slate-800'} p-6 rounded-2xl`}>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#D4AF37]">Step 3 — Replace Top Too? (Optional)</h3>
                {selectedTop && (
                  <button onClick={() => setSelectedTop(null)} className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1">
                    <X className="w-3 h-3" /> Clear
                  </button>
                )}
              </div>

              {selectedTop ? (
                <div className="flex items-center gap-4">
                  <img src={selectedTop.images?.[0]?.s3_url || selectedTop.image} alt={selectedTop.name} className="w-16 h-20 object-cover rounded-lg border border-[#D4AF37] bg-white" />
                  <div>
                    <p className="text-xs font-semibold text-white">{selectedTop.name}</p>
                    <p className="text-[10px] text-slate-400 mt-1">Will be draped in pass 1, then your pants in pass 2.</p>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-[10px] text-slate-400 mb-3">
                    Wearing a kurti in your photo? Select a top below — the AI will replace it first, then drape the pants. Skip if already wearing a short top.
                  </p>
                  <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                    {availableTops.map(top => (
                      <button
                        key={top.id}
                        onClick={() => setSelectedTop(top)}
                        className="flex-shrink-0 flex flex-col items-center gap-1 p-1 border border-slate-700 rounded-lg hover:border-[#D4AF37] transition-colors"
                      >
                        <img src={top.images?.[0]?.s3_url || top.image} alt={top.name} className="w-14 h-16 object-cover rounded bg-white" />
                        <span className="text-[8px] text-slate-400 w-14 truncate text-center">{top.name}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Action Button */}
          <button
            onClick={startTryOnPipeline}
            disabled={isProcessing || !personFile}
            className="w-full py-4 bg-gradient-to-r from-[#D4AF37] to-[#c49f2e] hover:from-[#c49f2e] hover:to-[#b08e28] text-[#0A192F] font-bold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isBottoms && selectedTop ? <Layers className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
            {isBottoms && selectedTop ? "Generate Full Outfit Try-On" : "Generate Virtual Try-On"}
          </button>

          {/* Status Banner */}
          {statusType && (
            <div className={`p-4 rounded-xl flex items-center gap-3 border ${
              statusType === 'processing' ? 'bg-[#D4AF37]/10 border-[#D4AF37]/30 text-[#D4AF37]' :
              statusType === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
              'bg-red-500/10 border-red-500/30 text-red-400'
            }`}>
              {statusType === 'processing' ? <RefreshCw className="w-5 h-5 animate-spin" /> : 
               statusType === 'success' ? <Check className="w-5 h-5" /> : 
               <AlertCircle className="w-5 h-5" />}
              <div>
                <strong className="text-xs uppercase tracking-wider block">
                  {statusType === 'processing' ? 'Processing...' : statusType === 'success' ? 'Success' : 'Error'}
                </strong>
                <p className="text-[10px] mt-0.5 opacity-80">{statusText}</p>
              </div>
            </div>
          )}

          {/* Post Result Actions */}
          {tryOnComplete && (
            <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl flex flex-col gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Select Size</p>
                <div className="flex flex-wrap gap-2">
                  {["S", "M", "L", "XL", "XXL"].map(sz => (
                    <button
                      key={sz}
                      onClick={() => { setSelectedSize(sz); setSizeError(false); }}
                      className={`w-10 h-10 rounded-full border text-xs font-bold transition-colors ${
                        selectedSize === sz ? 'bg-[#D4AF37] border-[#D4AF37] text-[#0A192F]' : 
                        sizeError ? 'border-red-500/50 text-red-400' : 'border-slate-700 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
                {sizeError && <p className="text-[10px] text-red-400 mt-2">Please select a size to continue.</p>}
              </div>
              <button 
                onClick={handleAddBag} 
                className="w-full py-3 bg-white text-black font-bold text-xs uppercase tracking-wider rounded-lg flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors"
              >
                <ShoppingBag className="w-4 h-4" /> Add to Bag
              </button>
              <button 
                onClick={resetAll} 
                className="w-full py-2.5 border border-slate-700 text-slate-300 font-bold text-xs uppercase tracking-wider rounded-lg hover:bg-slate-800 transition-colors"
              >
                Try Another Photo
              </button>
              {addedBag && (
                <div className="p-3 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold uppercase text-center rounded-lg">
                  Size {selectedSize} added to your bag.
                </div>
              )}
            </div>
          )}

        </div>

        {/* Right Preview Viewport */}
        <div className="flex flex-col gap-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 text-center">
            {tryOnComplete ? "Your New Look" : "Preview Canvas"}
          </span>
          <div className="w-full aspect-[3/4] max-w-[500px] mx-auto rounded-3xl overflow-hidden border border-slate-700 bg-black relative flex items-center justify-center shadow-2xl">
            {tryOnComplete && tryOnResultUrl ? (
              <img src={tryOnResultUrl} alt="Try On Result" className="w-full h-full object-contain" />
            ) : isProcessing ? (
              <>
                <img src={productImgUrl} alt={product.name} className="w-full h-full object-cover opacity-20 blur-sm" />
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
                  <RefreshCw className="w-10 h-10 text-[#D4AF37] animate-spin mb-4" />
                  <p className="text-sm font-bold text-[#D4AF37]">
                    {isBottoms && selectedTop ? 'Draping outfit on GPU (2 passes)...' : 'Draping on GPU...'}
                  </p>
                </div>
              </>
            ) : previewUrl ? (
              <>
                <img src={previewUrl} alt="Portrait Preview" className="w-full h-full object-contain opacity-60" />
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-black/40">
                  <Sparkles className="w-8 h-8 text-[#D4AF37] mb-3" />
                  <p className="text-sm font-bold text-white tracking-wide">Click Generate to try on</p>
                </div>
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900/40 p-6">
                <img src={productImgUrl} alt={product.name} className="max-h-[60%] w-auto object-contain opacity-50 drop-shadow-xl mb-6 rounded-lg" />
                <p className="text-xs text-slate-400 uppercase tracking-wider">Upload your photo to begin</p>
              </div>
            )}
          </div>
          {tryOnComplete && (
            <p className="text-[9px] text-slate-500 text-center uppercase tracking-wider">
              Generated by FASHN VTON 1.5 • Portrait deleted securely
            </p>
          )}
        </div>

      </div>

      {/* Guidelines Modal */}
      {showTipsModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0A192F] border border-[#D4AF37]/30 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-800 relative">
              <button onClick={() => setShowTipsModal(false)} className="absolute top-6 right-6 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
              <span className="text-[9px] font-bold uppercase tracking-widest text-[#D4AF37] mb-1 block">AI Photo Guidelines</span>
              <h2 className="text-xl font-serif text-white">{TIP_LABEL[fashnType as keyof typeof TIP_LABEL]}</h2>
            </div>
            <div className="p-6 bg-slate-900/50">
              <div className="flex gap-3 items-start mb-6">
                <Sparkles className="w-5 h-5 text-[#D4AF37] shrink-0 mt-0.5" />
                <p className="text-sm text-slate-300 leading-relaxed">{tips}</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowTipsModal(false)} className="flex-1 py-3 border border-slate-700 text-white text-xs font-bold uppercase rounded-lg hover:bg-slate-800 transition-colors">
                  Cancel
                </button>
                <button onClick={triggerFileInput} className="flex-[2] py-3 bg-[#D4AF37] hover:bg-[#c49f2e] text-[#0A192F] text-xs font-bold uppercase rounded-lg flex items-center justify-center gap-2 transition-colors">
                  Choose Photo <Upload className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
