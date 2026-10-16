"use client";
import Image from "next/image";

import { useState, useRef, useEffect } from "react";
import { ArrowLeft, Save, Sparkles, Image as ImageIcon, Box, Plus, X as XIcon, Upload, Loader2, Check, RotateCw, Eye, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { productsApi, categoriesApi, CategoryItem } from "@/lib/api";
import type { SizeChart } from "@/lib/sizeChart";
import { useRouter } from "next/navigation";
import { getSession } from "next-auth/react";
import { Product3DModal } from "@/components/3d/Product3DModal";
import PhotoUploadCard from "@/components/products/PhotoUploadCard";
import { SizeChartEditor } from "@/components/products/SizeChartEditor";

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

const tabs = [
  { id: "basic", label: "Basic Info" },
  { id: "pricing", label: "Pricing & Inventory" },
  { id: "images", label: "Product Images", icon: ImageIcon },
  { id: "3d", label: "3D Product", icon: Box, highlight: true },
];

interface UploadedImage {
  id: string;
  file: File;
  preview: string;
  label?: string;
}

interface ReconstructPhoto {
  file: File | null;
  preview: string | null;
}

export default function AddProductPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("basic");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Basic Info
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sku, setSku] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [gender, setGender] = useState("Women");
  const [sizeChart, setSizeChart] = useState<SizeChart>({
    unit: "in",
    headers: ["Size", "Chest (in)", "Waist (in)", "Hips (in)", "Length (in)"],
    rows: [],
  });
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [fabric, setFabric] = useState("");
  const [colour, setColour] = useState("");
  const [occasion, setOccasion] = useState("");
  const [modelPath, setModelPath] = useState("");
  const [isUploadingGlb, setIsUploadingGlb] = useState(false);
  const glbInputRef = useRef<HTMLInputElement>(null);

  // Pricing
  const [priceSelling, setPriceSelling] = useState("");
  const [priceMrp, setPriceMrp] = useState("");
  const [stockBySize, setStockBySize] = useState<Record<string, string>>({});
  const [isPublished, setIsPublished] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);

  // 2D Images
  const [images, setImages] = useState<UploadedImage[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // 3D Reconstruction
  const [frontPhoto, setFrontPhoto] = useState<ReconstructPhoto>({ file: null, preview: null });
  const [sidePhoto, setSidePhoto] = useState<ReconstructPhoto>({ file: null, preview: null });
  const [backPhoto, setBackPhoto] = useState<ReconstructPhoto>({ file: null, preview: null });
  const [reconstructing, setReconstructing] = useState(false);
  const [reconstructResult, setReconstructResult] = useState<string | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const frontRef = useRef<HTMLInputElement>(null);
  const sideRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    categoriesApi.list().then((data) => {
      setCategories(data || []);
      if (data && data.length > 0) setCategoryId(String(data[0].id));
    });
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  // ─── 2D Image Handlers ──────────────────────────────────────
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newImages: UploadedImage[] = files.map((file) => ({
      id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      preview: URL.createObjectURL(file),
    }));
    setImages((prev) => [...prev, ...newImages]);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const handleRemoveImage = (id: string) => {
    setImages((prev) => {
      const img = prev.find((i) => i.id === id);
      if (img) URL.revokeObjectURL(img.preview);
      return prev.filter((i) => i.id !== id);
    });
  };

  const handleMoveImage = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= images.length) return;
    setImages((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return updated;
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith("image/")
    );
    const newImages: UploadedImage[] = files.map((file) => ({
      id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      preview: URL.createObjectURL(file),
    }));
    setImages((prev) => [...prev, ...newImages]);
  };

  // ─── 3D Photo Handlers ──────────────────────────────────────
  const handlePhotoSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (v: ReconstructPhoto) => void
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      setter({ file, preview: URL.createObjectURL(file) });
    }
  };

  const handleReconstruct = async () => {
    if (!frontPhoto.file || !sidePhoto.file || !backPhoto.file) {
      showToast("Please upload all three photos (Front, Side, Back)");
      return;
    }
    setReconstructing(true);
    setReconstructResult(null);
    try {
      showToast("Sending photos to 3D garment generator service…");

      const formData = new FormData();
      formData.append("front_image", frontPhoto.file);
      if (sidePhoto.file) formData.append("side_image", sidePhoto.file);
      if (backPhoto.file) formData.append("back_image", backPhoto.file);
      if (categoryId) formData.append("category_id", categoryId);
      if (name) formData.append("product_name", name);

      let token = typeof window !== "undefined" ? localStorage.getItem("vastrax_token") : null;
      if (!token || token === "null") {
        try {
          const session = await getSession();
          if (session?.accessToken) {
            token = session.accessToken;
          }
        } catch {}
      }

      const res = await fetch("/api/v1/3d/generate", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || errJson.message || "Failed to generate 3D model");
      }

      const data = await res.json();
      const generatedModelUrl = data.model_url;
      if (!generatedModelUrl || data.generation_mode !== "hunyuan_textured") {
        throw new Error("A textured garment-specific reconstruction was not produced. No template was attached.");
      }
      setModelPath(generatedModelUrl);
      setReconstructResult(generatedModelUrl);
      showToast("Textured Hunyuan 3D model generated.");
    } catch (err: unknown) {
      console.error(err);
      showToast(`Reconstruction failed: ${err instanceof Error ? err.message : "Server error"}`);
    } finally {
      setReconstructing(false);
    }
  };

  const handleUploadGlb = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingGlb(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      
      if (data.success) {
        setModelPath(data.url);
        showToast("3D Model uploaded successfully!");
      } else {
        throw new Error(data.error || "Upload failed");
      }
    } catch (err: unknown) {
      console.error(err);
      showToast(err instanceof Error ? err.message : "Failed to upload model");
    } finally {
      setIsUploadingGlb(false);
      if (glbInputRef.current) glbInputRef.current.value = "";
    }
  };

  // ─── Save & Publish ─────────────────────────────────────────
  const handleSave = async (publish: boolean) => {
    if (!name.trim()) {
      showToast("Please enter a product name");
      setActiveTab("basic");
      return;
    }
    if (!colour.trim()) {
      showToast("Please enter the product colour so customers can filter by colour.");
      setActiveTab("basic");
      return;
    }
    if (!priceSelling || isNaN(parseFloat(priceSelling))) {
      showToast("Please enter a valid selling price");
      setActiveTab("pricing");
      return;
    }

    if (!sizeChart.rows.some((row) => row.size.trim())) {
      showToast("Add at least one size in the product size chart before saving.");
      setActiveTab("basic");
      return;
    }

    setSaving(true);
    try {
      // Ensure valid auth token from localStorage or active NextAuth session
      let token = typeof window !== "undefined" ? localStorage.getItem("vastrax_token") : null;
      if (!token || token === "null" || token === "undefined") {
        try {
          const session = await getSession();
          if (session?.accessToken) {
            token = session.accessToken;
            localStorage.setItem("vastrax_token", token!);
          }
        } catch {}
      }

      // Fallback token if available, but do not block product creation
      const imageDataUrls: string[] = [];
      for (const img of images) {
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(img.file);
        });
        imageDataUrls.push(dataUrl);
      }

      const payload = {
        name: name.trim(),
        description: description.trim(),
        category_id: categoryId || (categories.length > 0 ? String(categories[0].id) : ""),
        gender: gender || "Women",
        size_chart: sizeChart,
        fabric: fabric.trim() || undefined,
        colour: colour.trim() || undefined,
        occasion: occasion.trim() || undefined,
        model_path: modelPath.trim(),
        price_selling: parseFloat(priceSelling),
        price_mrp: priceMrp ? parseFloat(priceMrp) : parseFloat(priceSelling),
        is_published: publish,
        is_featured: isFeatured,
        variants: sizeChart.rows
          .filter((row) => row.size.trim())
          .map((row) => ({
            sku: (sku.trim() || "SKU-" + Date.now().toString().slice(-6)) + "-" + row.size.trim(),
            size: row.size.trim(),
            stock_qty: Math.max(0, Number.parseInt(stockBySize[row.size] || "0", 10) || 0),
          })),
        images: imageDataUrls.map((url, i) => ({ s3_url: url, display_order: i })),
      };

      const result = await productsApi.create(payload);
      if (result) {
        showToast(publish ? "Product published!" : "Draft saved!");
        setTimeout(() => router.push("/products"), 800);
      }
    } catch (err: unknown) {
      showToast(`Failed to save: ${err instanceof Error ? err.message : "Server error"}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-accent text-white px-4 py-3 rounded-xl shadow-2xl text-xs font-semibold flex items-center gap-2 animate-in slide-in-from-top duration-200">
          <span>✓</span>
          <span>{toast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/products"
          className="p-2 bg-surface hover:bg-surface-hover border border-border rounded-md transition-colors text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Add New Product</h1>
          <p className="text-sm text-muted-foreground">
            Create a new product listing with AI-enhanced media.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={() => handleSave(false)}
            disabled={saving}
            className="px-4 py-2 bg-background border border-border hover:bg-surface-hover rounded-md text-sm font-medium transition-colors disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Save Draft"
            )}
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent/90 text-white rounded-md text-sm font-medium transition-colors shadow-[0_0_15px_rgba(224,122,63,0.2)] disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Save className="w-4 h-4" />
                Publish Product
              </>
            )}
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar Tabs */}
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
                  {tab.highlight && (
                    <Sparkles className="w-3 h-3 text-accent" />
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-surface border border-border rounded-xl p-8 min-h-[600px]">
          {/* MEDIA AND PHOTOGRAPHY */}
          {activeTab === "basic" && (
            <div className="space-y-6 animate-in fade-in">
              <h2 className="text-lg font-semibold text-foreground mb-4">
                Basic Information
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Product Name <span className="text-accent">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Classic Silk Shirt"
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all text-foreground"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      SKU
                    </label>
                    <p className="mb-2 text-xs text-muted-foreground">A unique internal code used to identify and track this product or size variant in inventory.</p>
                    <p className="mb-2 text-xs text-muted-foreground">A unique internal code used to identify and track this product or size variant in inventory.</p>
                    <input
                      type="text"
                      value={sku}
                      onChange={(e) => setSku(e.target.value)}
                      placeholder="SH-SLK-001"
                      className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all text-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Category
                    </label>
                    <select
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all appearance-none text-foreground"
                    >
                      {categories.map((cat) => (
                        <option key={cat.id} value={String(cat.id)}>
                          {cat.name}
                        </option>
                      ))}
                      {categories.length === 0 && (
                        <option value="">No categories</option>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Department / Gender <span className="text-accent">*</span>
                    </label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all appearance-none text-foreground"
                    >
                      <option value="Women">Women</option>
                      <option value="Men">Men</option>
                      <option value="Kids">Kids</option>
                      <option value="Unisex">Unisex</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Fabric
                    </label>
                    <input
                      type="text"
                      value={fabric}
                      onChange={(e) => setFabric(e.target.value)}
                      placeholder="e.g. Silk, Cotton blend"
                      className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all text-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Colour <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={colour}
                      onChange={(e) => setColour(e.target.value)}
                      placeholder="e.g. Ivory, Midnight Blue"
                      required
                      className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all text-foreground"
                    />
                  </div>
                </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Occasion
                    </label>
                    <select
                      value={occasion}
                      onChange={(e) => setOccasion(e.target.value)}
                      className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all appearance-none text-foreground"
                    >
                      <option value="">Select Occasion</option>
                      <option value="Wedding / Festive">Wedding / Festive</option>
                      <option value="Office / Work">Office / Work</option>
                      <option value="Casual / Everyday">Casual / Everyday</option>
                      <option value="Party / Night out">Party / Night out</option>
                    </select>
                  </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Description
                  </label>
                  <textarea
                    rows={5}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the product..."
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all resize-none text-foreground"
                  />
                </div>
              </div>
              <div className="mt-6">
                <SizeChartEditor value={sizeChart} onChange={setSizeChart} />
              </div>
            </div>
          )}

          {/* PRICING & INVENTORY */}
          {activeTab === "pricing" && (
            <div className="space-y-6 animate-in fade-in">
              <h2 className="text-lg font-semibold text-foreground mb-4">
                Pricing & Inventory
              </h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Selling Price (₹) <span className="text-accent">*</span>
                    </label>
                    <input
                      type="number"
                      value={priceSelling}
                      onChange={(e) => setPriceSelling(e.target.value)}
                      placeholder="2499.00"
                      className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all text-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      MRP / Compare Price (₹)
                    </label>
                    <input
                      type="number"
                      value={priceMrp}
                      onChange={(e) => setPriceMrp(e.target.value)}
                      placeholder="3499.00"
                      className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all text-foreground"
                    />
                  </div>
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-medium text-foreground">Stock by size</h3>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {sizeChart.rows.filter((row) => row.size.trim()).map((row) => (
                      <label key={row.size} className="text-xs text-muted-foreground">
                        {row.size}
                        <input type="number" min="0" value={stockBySize[row.size] ?? "0"}
                          onChange={(event) => setStockBySize((current) => ({ ...current, [row.size]: event.target.value }))}
                          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
                      </label>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-border/50 mt-6">
                  <h3 className="text-sm font-medium text-foreground mb-4">Visibility & Status</h3>
                  <div className="flex items-center gap-10">
                    <label className="flex items-center gap-3 cursor-pointer select-none group">
                      <button
                        type="button"
                        onClick={() => setIsPublished(!isPublished)}
                        className={cn(
                          "w-11 h-6 rounded-full transition-colors relative flex items-center shadow-inner",
                          isPublished ? "bg-accent" : "bg-surface-hover border border-border"
                        )}
                      >
                        <span
                          className={cn(
                            "absolute w-4 h-4 rounded-full bg-white shadow-sm transition-all",
                            isPublished ? "translate-x-6" : "translate-x-1"
                          )}
                        />
                      </button>
                      <span className="text-sm font-medium text-foreground group-hover:text-accent transition-colors">
                        Published to Storefront
                      </span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer select-none group">
                      <button
                        type="button"
                        onClick={() => setIsFeatured(!isFeatured)}
                        className={cn(
                          "w-11 h-6 rounded-full transition-colors relative flex items-center shadow-inner",
                          isFeatured ? "bg-accent" : "bg-surface-hover border border-border"
                        )}
                      >
                        <span
                          className={cn(
                            "absolute w-4 h-4 rounded-full bg-white shadow-sm transition-all",
                            isFeatured ? "translate-x-6" : "translate-x-1"
                          )}
                        />
                      </button>
                      <span className="text-sm font-medium text-foreground group-hover:text-accent transition-colors">
                        Featured Item
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════ PRODUCT IMAGES (2D) ═══════════════ */}
          {activeTab === "images" && (
            <div className="space-y-6 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    Product Images
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    Upload 2D product photos. First image becomes the primary
                    thumbnail.
                  </p>
                </div>
                <span className="text-xs font-semibold text-accent bg-accent/10 border border-accent/20 px-2.5 py-1 rounded-full">
                  {images.length} image{images.length !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Hidden file input */}
              <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={handleImageSelect}
              />

              {/* Drop zone */}
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => imageInputRef.current?.click()}
                className="border-2 border-dashed border-border hover:border-accent/50 bg-background/50 rounded-xl p-10 flex flex-col items-center justify-center text-center transition-all cursor-pointer group hover:bg-accent/5"
              >
                <div className="w-14 h-14 bg-surface border border-border rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Upload className="w-6 h-6 text-muted-foreground group-hover:text-accent transition-colors" />
                </div>
                <h3 className="text-foreground font-medium mb-1">
                  Drag & Drop images here
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Supports JPG, PNG, WEBP up to 10MB each
                </p>
                <span className="px-4 py-2 bg-surface hover:bg-surface-hover border border-border rounded-md text-sm font-medium transition-colors text-foreground">
                  Browse Files
                </span>
              </div>

              {/* Upload status bar */}
              {images.length > 0 && (
                <div className="flex items-center justify-between bg-background border border-border rounded-xl px-5 py-3 mt-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center">
                        <ImageIcon className="w-4 h-4 text-accent" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-foreground">
                          {images.length} image{images.length !== 1 ? "s" : ""} uploaded
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {(images.reduce((acc, img) => acc + img.file?.size || 0, 0) / (1024 * 1024)).toFixed(1)} MB total
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/10 border border-accent/20 rounded-lg text-[11px] font-semibold text-accent hover:bg-accent/20 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      Add More
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        images.forEach((img) => URL.revokeObjectURL(img.preview));
                        setImages([]);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg text-[11px] font-semibold text-red-500 hover:bg-red-500/20 transition-colors"
                    >
                      <XIcon className="w-3 h-3" />
                      Clear All
                    </button>
                  </div>
                </div>
              )}

              {/* Image preview grid */}
              {images.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-4">
                  {images.map((img, idx) => (
                    <div
                      key={img.id}
                      className="relative aspect-square rounded-xl border border-border overflow-hidden group bg-surface-hover"
                    >
                      <Image width={1200} height={900} unoptimized
                        src={img.preview}
                        alt={`Product ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      {/* Primary badge */}
                      {idx === 0 && (
                        <span className="absolute top-2 left-2 bg-accent text-white text-[10px] font-bold px-2 py-0.5 rounded-full z-10">
                          PRIMARY
                        </span>
                      )}
                      {/* Remove button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(img.id)}
                        className="absolute top-2 right-2 w-6 h-6 bg-red-500/90 hover:bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      >
                        <XIcon className="w-3.5 h-3.5 text-white" />
                      </button>
                      {/* Reorder controls: gallery order follows the image list */}
                      <div className="absolute inset-x-2 bottom-10 flex justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                        <button type="button" disabled={idx === 0} onClick={() => handleMoveImage(idx, idx - 1)} aria-label="Move image earlier" title="Move image earlier" className="w-7 h-7 rounded-full bg-black/75 text-white flex items-center justify-center disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
                        <button type="button" disabled={idx === images.length - 1} onClick={() => handleMoveImage(idx, idx + 1)} aria-label="Move image later" title="Move image later" className="w-7 h-7 rounded-full bg-black/75 text-white flex items-center justify-center disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
                      </div>
                      {/* File name */}
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-2">
                        <p className="text-[10px] text-white font-medium truncate">
                          {img.file?.name}
                        </p>
                        <p className="text-[9px] text-white/60">
                          {((img.file?.size || 0) / 1024).toFixed(0)} KB
                        </p>
                      </div>
                      {/* Order badge */}
                      <span className="absolute top-2 right-10 bg-black/60 text-white text-[10px] font-bold px-2 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        #{idx + 1}
                      </span>
                    </div>
                  ))}
                  {/* Add more button */}
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className="aspect-square bg-background border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-accent/50 hover:bg-accent/5 transition-all group"
                  >
                    <Plus className="w-6 h-6 text-muted-foreground group-hover:text-accent transition-colors" />
                    <span className="text-[10px] text-muted-foreground mt-1.5 font-medium">
                      Add more
                    </span>
                  </button>
                </div>
              )}

              {/* 3D Model Section */}
              <div className="mt-8 pt-8 border-t border-border">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
                    <Box className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-foreground">
                      Interactive 3D Model
                    </h2>
                    <p className="text-[11px] text-muted-foreground">
                      Link a 3D .glb file for the immersive product viewer
                    </p>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5 flex justify-between items-center">
                    <span>3D Model Path (.glb)</span>
                    <button
                      type="button"
                      onClick={() => glbInputRef.current?.click()}
                      disabled={isUploadingGlb}
                      className="text-xs text-accent hover:text-accent/80 transition-colors flex items-center gap-1 disabled:opacity-50"
                    >
                      {isUploadingGlb ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                      Upload File
                    </button>
                  </label>
                  <input
                    type="file"
                    accept=".glb"
                    ref={glbInputRef}
                    className="hidden"
                    onChange={handleUploadGlb}
                  />
                  {modelPath && (
                    <button type="button" onClick={() => { setModelPath(""); setReconstructResult(null); }} className="mb-2 text-xs font-medium text-red-500 hover:underline">
                      Remove attached 3D model
                    </button>
                  )}
                  <input
                    type="text"
                    value={modelPath}
                    onChange={(e) => setModelPath(e.target.value)}
                    placeholder="/models/3d/my-model.glb"
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all text-foreground"
                  />
                </div>
              </div>

            </div>
          )}


          {/* 3D PRODUCT */}
          {activeTab === "3d" && (
            <div className="space-y-8 animate-in fade-in">
              {/* Header */}
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
                    <Box className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">
                      3D Model Reconstruction
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Upload garment photos for a 3D preview
                    </p>
                  </div>
                </div>
              </div>

              {/* Info banner */}
              <div className="bg-accent/5 border border-accent/20 rounded-xl p-4 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                <div className="text-xs text-muted-foreground leading-relaxed">
                  <span className="font-semibold text-foreground">
                    Current limitation:
                  </span>{" "}
                  Hunyuan currently reconstructs the shape from the front photo
                  only; side and back photos are not used as reconstruction
              constraints. Review the generated model carefully before saving.
                </div>
              </div>

              {/* 3-Photo Upload Grid */}
              <div className="grid grid-cols-3 gap-6">
                <PhotoUploadCard
                  label="Front View"
                  photo={frontPhoto}
                  inputRef={frontRef}
                  onSelect={(e) => handlePhotoSelect(e, setFrontPhoto)}
                  onClear={() => setFrontPhoto({ file: null, preview: null })}
                />
                <PhotoUploadCard
                  label="Side View"
                  photo={sidePhoto}
                  inputRef={sideRef}
                  onSelect={(e) => handlePhotoSelect(e, setSidePhoto)}
                  onClear={() => setSidePhoto({ file: null, preview: null })}
                />
                <PhotoUploadCard
                  label="Back View"
                  photo={backPhoto}
                  inputRef={backRef}
                  onSelect={(e) => handlePhotoSelect(e, setBackPhoto)}
                  onClear={() => setBackPhoto({ file: null, preview: null })}
                />
              </div>

              {/* Upload status summary */}
              <div className="flex items-center justify-between bg-background border border-border rounded-xl px-5 py-3">
                <div className="flex items-center gap-4">
                  {[
                    { label: "Front", ok: !!frontPhoto.file },
                    { label: "Side", ok: !!sidePhoto.file },
                    { label: "Back", ok: !!backPhoto.file },
                  ].map((s) => (
                    <span
                      key={s.label}
                      className={cn(
                        "flex items-center gap-1.5 text-xs font-semibold",
                        s.ok ? "text-emerald-500" : "text-muted-foreground/50"
                      )}
                    >
                      {s.ok ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <span className="w-3.5 h-3.5 rounded-full border border-current" />
                      )}
                      {s.label}
                    </span>
                  ))}
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {[frontPhoto, sidePhoto, backPhoto].filter((p) => p.file)
                    .length}{" "}
                  / 3 uploaded
                </span>
              </div>

              {/* Reconstruct Button */}
              <div className="flex flex-col items-center gap-4 pt-2">
                <button
                  type="button"
                  onClick={handleReconstruct}
                  disabled={
                    reconstructing ||
                    !frontPhoto.file ||
                    !sidePhoto.file ||
                    !backPhoto.file
                  }
                  className={cn(
                    "flex items-center gap-3 px-8 py-3.5 rounded-full text-sm font-bold transition-all shadow-lg",
                    frontPhoto.file && sidePhoto.file && backPhoto.file
                      ? "bg-accent hover:bg-accent/90 text-white shadow-[0_0_25px_rgba(224,122,63,0.3)] hover:shadow-[0_0_35px_rgba(224,122,63,0.4)]"
                      : "bg-surface border border-border text-muted-foreground cursor-not-allowed",
                    reconstructing && "opacity-70 cursor-wait"
                  )}
                >
                  {reconstructing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Reconstructing 3D Model…
                    </>
                  ) : (
                    <>
                      <RotateCw className="w-5 h-5" />
                      Reconstruct 3D Model
                    </>
                  )}
                </button>

                {!frontPhoto.file || !sidePhoto.file || !backPhoto.file ? (
                  <p className="text-xs text-muted-foreground">
                    Upload all three photos to enable reconstruction
                  </p>
                ) : null}
              </div>

              {/* Result */}
              {reconstructResult && (
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-6 text-center animate-in fade-in zoom-in-95 duration-300">
                  <div className="w-14 h-14 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Check className="w-7 h-7 text-emerald-500" />
                  </div>
                  <h3 className="text-foreground font-semibold mb-1">
                    3D Model Ready
                  </h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    The GLB model has been generated and will be attached to this
                    product when you publish.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsPreviewModalOpen(true)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent/90 text-white rounded-lg text-xs font-semibold transition-all shadow-md mx-auto cursor-pointer"
                  >
                    <Eye className="w-4 h-4" />
                    Preview 3D Model
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Product3DModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        product={{
          id: "preview",
          name: name || "Garment 3D Model",
          price: parseFloat(priceSelling) || 0,
          model3dUrl: modelPath || undefined,
        }}
      />
    </div>
  );
}
