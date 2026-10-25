"use client";
import Image from "next/image";

import React, { useState, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Sparkles, Upload, RefreshCw, Check, ShoppingBag,
  AlertCircle, X, Camera
} from "lucide-react";
import { tryonApi, productsApi, ProductItem } from "@/lib/api";
import { useSession } from "next-auth/react";
import { addToCart as addCartItem } from "@/lib/cart";
import { showToast } from "@/lib/toast";

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

interface TryOnGarment {
  id: string | number;
  name?: string;
  title?: string;
  category?: string;
  category_name?: string;
  category_id?: string | number;
  price?: number | string;
  price_selling?: number;
  colour?: string;
  hem_length?: "knee" | "midi" | "ankle" | "floor" | null;
  image?: string;
  images?: ProductItem["images"];
}

function isTwoPieceProduct(p: TryOnGarment): boolean {
  const details = [p.name, p.title, p.category, p.category_name, p.category_id]
    .filter((value) => value != null)
    .join(" ")
    .toLowerCase();
  return /\bcoord(?:inate)?\b|\bco[- ]?ord\b|\btwo[- ]?piece\b|\b2[- ]?piece\b|\bset\b|skirt\s*(?:and|&)\s*top|top\s*(?:and|&)\s*skirt/.test(details);
}

export default function VirtualTryOnPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { data: session } = useSession();

  const defaultGarment = {
    id: id || "",
    name: "",
    category: "",
    price: "",
    image: "/product-placeholder.svg"
  };

  const [products, setProducts] = useState<ProductItem[]>([]);
  const [product, setProduct] = useState<TryOnGarment>(defaultGarment);

  const [personFile, setPersonFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [selectedTop, setSelectedTop] = useState<ProductItem | null>(null);
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
        if (allProducts && allProducts.length > 0) {
          setProducts(allProducts);
          const current = allProducts.find((p) => p.id.toString() === id) || allProducts[0];
          setProduct({ ...current, name: current.name || current.title || "Luxury garment" });
        }
      } catch (e) {
        console.error("Failed to load products", e);
      }
    }
    void Promise.resolve().then(loadData);
  }, [id]);

  // Auth guard — redirect to product page if not logged in (direct URL access)
  useEffect(() => {
    if (session === null) {
      // session===null means NextAuth has resolved and user is NOT authenticated
      router.replace(`/storefront/product?id=${id}&requireAuth=1`);
    }
  }, [session, id, router]);

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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-foreground">
          <RefreshCw className="w-8 h-8 animate-spin text-[#e07a3f]" />
          <p>Loading Garment Data...</p>
        </div>
      </div>
    );
  }

  const getGarmentImage = (p: TryOnGarment | null) => {
    if (!p) return "/product-placeholder.svg";
    if (p.image && !p.image.includes("photo-1515347619362")) return p.image;
    if (Array.isArray(p.images) && p.images.length > 0) {
      const url = typeof p.images[0] === "string" ? p.images[0] : p.images[0]?.s3_url || p.images[0]?.url;
      if (url && !url.includes("photo-1515347619362")) return url;
    }
    return "/product-placeholder.svg";
  };

  const getGarmentImageOptions = (p: TryOnGarment) => {
    const sources = [
      ...(Array.isArray(p.images) ? p.images : []),
      ...(p.image ? [p.image] : []),
    ];
    const options: { url: string; label: string; role?: string }[] = [];
    for (const source of sources) {
      const record = typeof source === "string" ? null : source;
      const url = typeof source === "string" ? source : (record?.s3_url || record?.url);
      if (!url || url.includes("photo-1515347619362") || options.some((option) => option.url === url)) continue;
      const names = record ? [record.name, record.label, record.filename, record.alt].filter((value): value is string => typeof value === "string") : [];
      const fileLabel = url.split(/[/?#]/).filter(Boolean).pop()?.replace(/[-_]+/g, " ");
      const role = record && typeof record.tryon_role === "string" ? record.tryon_role : undefined;
      options.push({ url, label: names[0] || fileLabel || "Product image " + (options.length + 1), role });
    }
    return options;
  };

  const getFashnCategory = (cat: string, name: string = "") => {
    const combined = (cat + " " + name).toLowerCase();
    if (combined.includes("dress") || combined.includes("frock") || combined.includes("gown") || combined.includes("bodycon") || combined.includes("kurti") || combined.includes("one-piece") || combined.includes("cat-dresses")) return "one-pieces";
    if (combined.includes("pant") || combined.includes("bottom") || combined.includes("denim") || combined.includes("skirt") || combined.includes("trouser") || combined.includes("cat-bottoms")) return "bottoms";
    return "tops";
  };

  const twoPieceSet = isTwoPieceProduct(product);
  const fashnType = getFashnCategory(
    String(product.category_name || product.category || product.category_id || ""),
    product.name || product.title || ""
  );
  const isBottoms = !twoPieceSet && fashnType === "bottoms";
  const availableTops = products.filter(p => getFashnCategory(String(p.category_name || p.category || p.category_id || ""), p.name || "") === "tops" && String(p.id) !== String(product.id));
  const setImageOptions = getGarmentImageOptions(product);
  const selectedTopImage = setImageOptions.find((image) => image.role === "top");
  const selectedBottomImage = setImageOptions.find((image) => image.role === "bottom");
  const bottomPieceLabel = /skirt/i.test(product.name || product.title || "") ? "Skirt" : "Bottom";
  const isCombo = twoPieceSet || (isBottoms && selectedTop !== null);

  const startTryOnPipeline = async () => {
    if (!personFile || !product) return;

    if (twoPieceSet && (!selectedTopImage || !selectedBottomImage)) {
      setStatusType("error");
      setStatusText("This set needs separate Top and Bottom photos in the product gallery before try-on can run.");
      return;
    }
    setIsProcessing(true);
    setTryOnComplete(false);
    setStatusType("processing");
    setStatusText(isCombo ? "The virtual fitting room is processing both garments on the GPU. This can take a few minutes when the GPU is busy." : "The virtual fitting room is processing your photo on the GPU. This can take a few minutes when the GPU is busy.");

    try {
      let res;
      const targetGarmentImg = getGarmentImage(product);
      if (twoPieceSet) {
        res = await tryonApi.submitCombo(personFile, selectedTopImage!.url, selectedBottomImage!.url, product.id);
      } else if (isCombo) {
        const topImg = getGarmentImage(selectedTop);
        res = await tryonApi.submitCombo(personFile, topImg, targetGarmentImg, product.id);
      } else {
        res = await tryonApi.submitDirect(personFile, targetGarmentImg, fashnType, product.id);
      }

      if (res && res.result_image_url) {
        setTryOnResultUrl(res.result_image_url);
        setTryOnComplete(true);
        setStatusType("success");
        setStatusText(`Done! ${isCombo ? "Full outfit draped" : "Garment draped"}.`);
      } else {
        throw new Error("Try-on response failed.");
      }
    } catch (err: unknown) {
      setStatusType("error");
      setStatusText(err instanceof Error ? err.message : "Failed to process virtual try-on.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddBag = () => {
    if (!selectedSize) {
      setSizeError(true);
      return;
    }
    const priceNum = typeof product.price_selling === 'number'
      ? product.price_selling
      : typeof product.price === 'number'
      ? product.price
      : 2499;

    addCartItem({
      id: product.id,
      name: product.name || product.title || "Luxury garment",
      price: priceNum,
      quantity: 1,
      size: selectedSize,
      color: product.colour || "Default",
      image: getGarmentImage(product)
    });

    showToast({
      title: "Added to Shopping Bag",
      description: `${product.name} (Size: ${selectedSize})`,
      type: "gold",
      image: getGarmentImage(product),
      duration: 3000
    });

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

  const tips = twoPieceSet
    ? "Upload a full-body photo. We apply the product’s top and matching skirt/bottom as the two pieces of this set; no extra trouser garment is selected."
    : PHOTO_TIPS[fashnType as keyof typeof PHOTO_TIPS] || PHOTO_TIPS.tops;
  const tipLabel = twoPieceSet ? "Two-Piece Set Try-On Guide" : TIP_LABEL[fashnType as keyof typeof TIP_LABEL];
  const productImgUrl = getGarmentImage(product);

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      {/* Header */}
      <header className="px-6 py-6 border-b border-border">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-[#e07a3f] transition-colors"
          >
            ← Back to Product
          </button>
          <div className="text-xl font-serif font-bold text-foreground tracking-wider flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#e07a3f]" />
            AI FITTING ROOM
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <div className="max-w-[1000px] mx-auto mt-8 px-4 grid grid-cols-1 md:grid-cols-[400px_1fr] gap-8 items-start">

        {/* Left Controls */}
        <div className="flex flex-col gap-6">

          {/* Step 1 */}
          <div className="bg-surface border border-border p-6 rounded-2xl">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#e07a3f] mb-4">Step 1 — Your Photo</h3>
            <div
              onClick={previewUrl ? triggerFileInput : () => setShowTipsModal(true)}
              onDragOver={onDragOver}
              onDrop={onDrop}
              className={`w-full min-h-[200px] border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-4 cursor-pointer transition-all ${
                previewUrl ? "border-[#e07a3f]/50 bg-background/40" : "border-border hover:border-[#e07a3f] bg-background/30"
              }`}
            >
              <input type="file" ref={fileInputRef} onChange={onFileChange} accept="image/*" className="hidden" />
              {previewUrl ? (
                <Image width={1200} height={900} unoptimized src={previewUrl} alt="Portrait" className="max-h-[220px] object-contain rounded-lg" />
              ) : (
                <div className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-full bg-[#e07a3f]/20 flex items-center justify-center mb-3">
                    <Camera className="w-5 h-5 text-[#e07a3f]" />
                  </div>
                  <strong className="text-sm text-foreground">Upload your photo</strong>
                  <p className="text-xs text-muted-foreground mt-1">Drag & drop or click to choose</p>
                  <p className="text-[10px] text-muted-foreground/80 mt-1">JPG, PNG — up to 10 MB</p>
                </div>
              )}
            </div>
          </div>

          {/* Step 2 */}
          <div className="bg-surface border border-border p-6 rounded-2xl relative">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#e07a3f]">Step 2 — Garment Selected</h3>
              <button
                onClick={() => setShowGarmentList(!showGarmentList)}
                className="text-[10px] font-bold uppercase text-muted-foreground hover:text-foreground"
              >
                {showGarmentList ? "Hide List ▴" : "Change Garment ▾"}
              </button>
            </div>

            {showGarmentList && (
              <div className="absolute top-14 right-6 w-[280px] max-h-[300px] overflow-y-auto bg-surface border border-[#e07a3f]/30 rounded-xl shadow-2xl z-20 p-2 flex flex-col gap-2">
                {products.map(p => {
                  const pImg = getGarmentImage(p);
                  const isSelected = p.id === product.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        setProduct(p);
                        setSelectedTop(null);
                        router.push(`/storefront/product/${p.id}/tryon`);
                        resetAll();
                        setShowGarmentList(false);
                      }}
                      className={`flex items-center gap-3 p-2 rounded-lg transition-colors text-left ${
                        isSelected ? "bg-[#e07a3f]/20 border border-[#e07a3f]" : "hover:bg-white/5 border border-transparent"
                      }`}
                    >
              <Image width={1200} height={900} unoptimized src={String(pImg || "/placeholder.svg")} alt={String(p.name || "Product")} className="w-10 h-12 object-contain rounded bg-[#f8f7f4] p-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-foreground truncate max-w-[180px]">{p.name}</p>
                        <p className="text-[10px] text-muted-foreground">₹{(p.price_selling || p.price)?.toLocaleString()}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex gap-4 items-center">
              {twoPieceSet ? (
                <div className="grid shrink-0 grid-cols-2 gap-2">
                  {[
                    { label: "Top", image: selectedTopImage },
                    { label: bottomPieceLabel, image: selectedBottomImage },
                  ].map(({ label, image }) => (
                    <div key={label} className="w-[4.5rem] text-center">
                      <Image
                        width={1200}
                        height={900}
                        unoptimized
                        src={String(image?.url || "/product-placeholder.svg")}
                        alt={String(product.name || "Product") + " " + label.toLowerCase() + " garment"}
                        className="h-24 w-full rounded-lg border border-border bg-[#f8f7f4] p-1 object-contain"
                      />
                      <span className="mt-1 block text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <Image width={1200} height={900} unoptimized src={String(productImgUrl || "/product-placeholder.svg")} alt={String(product.name || "Product")} className="w-20 h-24 object-contain rounded-lg border border-border bg-[#f8f7f4] p-1" />
              )}
              <div>
                <h4 className="text-sm font-semibold text-foreground">{product.name}</h4>
                {product.hem_length && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Actual skirt length: {{ knee: "Knee length", midi: "Midi length", ankle: "Ankle length", floor: "Floor length" }[product.hem_length]}. AI preview may vary; use the product photos as the accurate reference.
                  </p>
                )}
                {!twoPieceSet && (
                  <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-muted-foreground mt-1 inline-block">
                    {fashnType}
                  </span>
                )}
                <p className="text-sm font-bold text-[#e07a3f] mt-1">₹{(product.price_selling || product.price)?.toLocaleString()}</p>
                {twoPieceSet && (!selectedTopImage || !selectedBottomImage) && <p className="mt-2 text-xs text-red-500">Separate Top and Bottom photos are required for try-on.</p>}
              </div>
            </div>
          </div>


          {/* Optional top replacement for a standalone bottom garment. */}
          {isBottoms && (
            <div className={`bg-surface border ${selectedTop ? 'border-[#e07a3f]' : 'border-border'} p-6 rounded-2xl`}>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#e07a3f]">Step 3 — Replace Top Too? (Optional)</h3>
                {selectedTop && (
                  <button onClick={() => setSelectedTop(null)} className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1">
                    <X className="w-3 h-3" /> Clear
                  </button>
                )}
              </div>
              {selectedTop ? (
                <div className="flex items-center gap-4">
                  <Image width={1200} height={900} unoptimized src={getGarmentImage(selectedTop)} alt={selectedTop.name || "Selected garment"} className="w-16 h-20 object-contain rounded-lg border border-[#e07a3f] bg-[#f8f7f4] p-1" />
                  <div>
                    <p className="text-xs font-semibold text-foreground">{selectedTop.name}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Will be draped first, followed by the selected bottom.</p>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-[10px] text-muted-foreground mb-3">
                    Select a top to replace the one in your photo, then the selected bottom garment will be applied.
                  </p>
                  <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                    {availableTops.map(top => (
                      <button
                        key={top.id}
                        onClick={() => setSelectedTop(top)}
                        className="flex-shrink-0 flex flex-col items-center gap-1 p-1 border border-border rounded-lg hover:border-[#e07a3f] transition-colors"
                      >
                        <Image width={1200} height={900} unoptimized src={getGarmentImage(top)} alt={top.name || "Garment"} className="w-14 h-16 object-contain rounded bg-[#f8f7f4] p-0.5" />
                        <span className="text-[8px] text-muted-foreground w-14 truncate text-center">{top.name}</span>
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
            disabled={isProcessing || !personFile || (twoPieceSet && (!selectedTopImage || !selectedBottomImage))}
            className="w-full py-4 bg-gradient-to-r from-[#e07a3f] to-[#b95625] hover:from-[#b95625] hover:to-[#9b4a23] text-white font-bold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Generate
          </button>

          {/* Status Banner */}
          {statusType && (
            <div className={`p-4 rounded-xl flex items-center gap-3 border ${
              statusType === 'processing' ? 'bg-[#e07a3f]/10 border-[#e07a3f]/30 text-[#e07a3f]' :
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
            <div className="bg-surface border border-border p-6 rounded-2xl flex flex-col gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Select Size</p>
                <div className="flex flex-wrap gap-2">
                  {["S", "M", "L", "XL", "XXL"].map(sz => (
                    <button
                      key={sz}
                      onClick={() => { setSelectedSize(sz); setSizeError(false); }}
                      className={`w-10 h-10 rounded-full border text-xs font-bold transition-colors ${
                        selectedSize === sz ? 'bg-[#e07a3f] border-[#e07a3f] text-white' :
                        sizeError ? 'border-red-500/50 text-red-400' : 'border-border text-muted-foreground hover:border-border'
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
                className="w-full py-2.5 border border-border text-muted-foreground font-bold text-xs uppercase tracking-wider rounded-lg hover:bg-background transition-colors"
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
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-center">
            {tryOnComplete ? "Your New Look" : "Preview Canvas"}
          </span>
          <div className="w-full aspect-[3/4] max-w-[500px] mx-auto rounded-3xl overflow-hidden border border-border bg-background relative flex items-center justify-center shadow-2xl">
            {tryOnComplete && tryOnResultUrl ? (
              <Image width={1200} height={900} unoptimized
                src={tryOnResultUrl}
                alt="Try On Result"
                className="w-full h-full object-contain"
                onError={(e) => {
                  const img = e.currentTarget;
                  if (!img.dataset.retried) {
                    img.dataset.retried = "true";
                    img.src = tryOnResultUrl.startsWith("http")
                      ? tryOnResultUrl
                      : window.location.origin + (tryOnResultUrl.startsWith("/") ? "" : "/") + tryOnResultUrl;
                  }
                }}
              />
            ) : isProcessing ? (
              <>
                <Image width={1200} height={900} unoptimized src={String(productImgUrl || "/placeholder.svg")} alt={String(product.name || "Product")} className="w-full h-full object-cover opacity-20 blur-sm" />
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
                  <RefreshCw className="w-10 h-10 text-[#e07a3f] animate-spin mb-4" />
                  <p className="text-sm font-bold text-[#e07a3f]">
                    {isBottoms && selectedTop ? 'Draping outfit on GPU (2 passes)...' : 'Draping on GPU...'}
                  </p>
                </div>
              </>
            ) : previewUrl ? (
              <>
                <Image width={1200} height={900} unoptimized src={String(previewUrl || "/placeholder.svg")} alt="Portrait Preview" className="w-full h-full object-contain opacity-60" />
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-background/40">
                  <Sparkles className="w-8 h-8 text-[#e07a3f] mb-3" />
                  <p className="text-sm font-bold text-foreground tracking-wide">Click Generate to try on</p>
                </div>
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-surface/40 p-6">
                <Image width={1200} height={900} unoptimized src={String(productImgUrl || "/placeholder.svg")} alt={String(product.name || "Product")} className="max-h-[60%] w-auto object-contain opacity-50 drop-shadow-xl mb-6 rounded-lg" />
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Upload your photo to begin</p>
              </div>
            )}
          </div>
          {tryOnComplete && (
            <p className="text-[9px] text-muted-foreground/80 text-center uppercase tracking-wider">
              Generated by FASHN VTON 1.5 • Portrait deleted securely
            </p>
          )}
        </div>

      </div>

      {/* Guidelines Modal */}
      {showTipsModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-background border border-[#e07a3f]/30 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-border relative">
              <button onClick={() => setShowTipsModal(false)} className="absolute top-6 right-6 text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
              <span className="text-[9px] font-bold uppercase tracking-widest text-[#e07a3f] mb-1 block">AI Photo Guidelines</span>
              <h2 className="text-xl font-serif text-foreground">{tipLabel}</h2>
            </div>
            <div className="p-6 bg-surface">
              <div className="flex gap-3 items-start mb-6">
                <Sparkles className="w-5 h-5 text-[#e07a3f] shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground leading-relaxed">{tips}</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowTipsModal(false)} className="flex-1 py-3 border border-border text-foreground text-xs font-bold uppercase rounded-lg hover:bg-background transition-colors">
                  Cancel
                </button>
                <button onClick={triggerFileInput} className="flex-[2] py-3 bg-[#e07a3f] hover:bg-[#b95625] text-white text-xs font-bold uppercase rounded-lg flex items-center justify-center gap-2 transition-colors">
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
