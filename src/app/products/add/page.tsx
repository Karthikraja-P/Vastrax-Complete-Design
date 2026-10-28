"use client";
import Image from "next/image";

import { useState, useRef, useEffect } from "react";
import { ArrowLeft, Save, Plus, X as XIcon, Upload, Loader2, Check, RotateCw, Eye, ChevronLeft, ChevronRight, Star, GripVertical } from "lucide-react";
import Link from "next/link";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { productsApi, categoriesApi, CategoryItem } from "@/lib/api";
import type { SizeChart } from "@/lib/sizeChart";
import { useRouter } from "next/navigation";
import { getSession } from "next-auth/react";
import { Product3DModal } from "@/components/3d/Product3DModal";
import { generateThreeDModel } from "@/lib/threeDGeneration";
import PhotoUploadCard from "@/components/products/PhotoUploadCard";
import { SizeChartEditor } from "@/components/products/SizeChartEditor";
import AdminTryOnImageGenerator from "@/components/products/AdminTryOnImageGenerator";
import { generateProductCode } from "@/lib/product-code";

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

const tabs = [
  { id: "basic", label: "Basic Info", required: true },
  { id: "pricing", label: "Pricing & Inventory", required: true },
  { id: "images", label: "Product Images", required: true },
  { id: "3d", label: "3D Product" },
];

interface UploadedImage {
  id: string;
  file: File;
  sourceFile?: File;
  preview: string;
  label?: string;
  tryonRole?: "top" | "bottom" | "gallery" | "set";
}

interface ReconstructPhoto {
  file: File | null;
  preview: string | null;
}

function isTwoPieceProductName(value: string): boolean {
  return /\bcoord(?:inate)?\b|\bco[- ]?ord\b|\btwo[- ]?piece\b|\b2[- ]?piece\b|\bset\b|skirt\s*(?:and|&)\s*top|top\s*(?:and|&)\s*skirt/i.test(value);
}

function isSkirtProductName(value: string): boolean {
  return /\bskirt\b|\blehenga\b/i.test(value);
}

const hemLengthOptions = [
  { value: "knee", label: "Knee length" },
  { value: "midi", label: "Midi length" },
  { value: "ankle", label: "Ankle length" },
  { value: "floor", label: "Floor length" },
] as const;

function inferTryOnRole(filename: string): "top" | "bottom" | "gallery" {
  if (/\b(bottom|skirt|pant|trouser|palazzo)\b/i.test(filename)) return "bottom";
  if (/\b(top|blouse|shirt)\b/i.test(filename)) return "top";
  return "gallery";
}

export default function AddProductPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("basic");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Basic Info
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [productDetails, setProductDetails] = useState("");
  const [howToStyle, setHowToStyle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [gender, setGender] = useState("Women");
  const [sizeChart, setSizeChart] = useState<SizeChart>({
    unit: "in",
    headers: ["Size", "Bust (in)", "Waist (in)", "Hip (in)"],
    rows: [],
  });
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [fabric, setFabric] = useState("");
  const [colour, setColour] = useState("");
  const [occasion, setOccasion] = useState("");
  const [hemLength, setHemLength] = useState("");
  const [isProcessingImageBackground, setIsProcessingImageBackground] = useState(false);
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
  const [reconstructStatus, setReconstructStatus] = useState("");
  const [reconstructError, setReconstructError] = useState("");
  const [reconstructResult, setReconstructResult] = useState<string | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const frontRef = useRef<HTMLInputElement>(null);
  const sideRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLInputElement>(null);

  const selectedCategoryName = categories.find((category) => String(category.id) === categoryId)?.name || "";
  const generatedProductCodes = sizeChart.rows
    .map((row) => generateProductCode({ category: selectedCategoryName, style: name, colour, size: row.size }))
    .filter(Boolean);

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

  const handleSizeChartChange = (nextSizeChart: SizeChart) => {
    setSizeChart(nextSizeChart);
    setStockBySize((current) => Object.fromEntries(
      nextSizeChart.rows.map((row) => [row.size, current[row.size] ?? "0"])
    ));
  };

  // ─── 2D Image Handlers ──────────────────────────────────────
  const addProductImages = async (files: File[]) => {
    if (!files.length) return;
    const newImages = files.map((file, index): UploadedImage => ({
      id: `img-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
      // Keep the uploaded source unchanged; background color-key replacement
      // can alter light fabrics, prints, and embroidery.
      file,
      sourceFile: file,
      preview: URL.createObjectURL(file),
      tryonRole: inferTryOnRole(file.name),
    }));
    setImages((previous) => [...previous, ...newImages]);
  };

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    void addProductImages(files);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const handleGeneratedImage = async (file: File, modelName: string) => {
    setIsProcessingImageBackground(true);
    try {
      // Keep the inference result byte-for-byte; border-color replacement can
      // eat light fabric and embroidery that resembles the chosen backdrop.
      const generated: UploadedImage = {
        id: `tryon-${Date.now()}`,
        file,
        preview: URL.createObjectURL(file),
        label: `AI try-on - ${modelName}`,
        tryonRole: "gallery",
      };
      setImages((current) => [...current, generated]);
      showToast(`Try-on image added for ${modelName}`);
    } catch (error) {
      console.error("Could not prepare the try-on image:", error);
      showToast("Could not prepare the try-on image.");
    } finally {
      setIsProcessingImageBackground(false);
    }
  };

  const handleSelectTryOnImage = (id: string, role: "top" | "bottom" | "set") => {
    setImages((current) => current.map((image) => {
      if (image.id === id) return { ...image, tryonRole: image.tryonRole === role ? "gallery" : role };
      return image.tryonRole === role ? { ...image, tryonRole: "gallery" } : image;
    }));
  };

  const handleSelectTopImage = (id: string) => handleSelectTryOnImage(id, "top");

  const handleRemoveImage = (id: string) => {
    setImages((prev) => {
      const img = prev.find((i) => i.id === id);
      if (img?.preview.startsWith("blob:")) URL.revokeObjectURL(img.preview);
      return prev.filter((i) => i.id !== id);
    });
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files).filter((file) => file.type.startsWith("image/"));
    void addProductImages(files);
  };

  // Image Reordering & Swapping Handlers
  const handleMoveImage = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= images.length) return;
    setImages((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return updated;
    });
  };

  const handleMakePrimary = (index: number) => {
    if (index === 0) return;
    handleMoveImage(index, 0);
    showToast("Primary cover image set");
  };

  const [draggedImageIndex, setDraggedImageIndex] = useState<number | null>(null);

  const handleCardDragStart = (e: React.DragEvent, index: number) => {
    setDraggedImageIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleCardDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleCardDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedImageIndex === null || draggedImageIndex === dropIndex) return;
    handleMoveImage(draggedImageIndex, dropIndex);
    setDraggedImageIndex(null);
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
    setReconstructStatus("Submitting 3D reconstruction…");
    setReconstructError("");
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

      const generation = await generateThreeDModel(formData, token, (job) => {
        setReconstructStatus(job.message || "Generating the 3D model…");
      });
      const generatedModelUrl = generation.model_url;
      if (!generatedModelUrl) {
        throw new Error("The 3D service finished without returning a model path.");
      }
      setModelPath(generatedModelUrl);
      setReconstructResult(generatedModelUrl);
      setReconstructStatus("3D model ready to preview.");
      showToast("Textured Hunyuan 3D model generated.");
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Unexpected server error. Please retry.";
      setReconstructError(message);
      setReconstructStatus("3D reconstruction failed.");
      showToast(`Reconstruction failed: ${message}`);
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
    if (!categoryId) {
      showToast("Choose a category before saving.");
      setActiveTab("basic");
      return;
    }
    if (!description.trim()) {
      showToast("Enter a product description before saving.");
      setActiveTab("basic");
      return;
    }
    if (!fabric.trim()) {
      showToast("Enter the fabric before saving.");
      setActiveTab("basic");
      return;
    }
    if (!colour.trim()) {
      showToast("Enter the product colour before saving.");
      setActiveTab("basic");
      return;
    }

    const regularPrice = Number.parseFloat(priceSelling);
    const offerPrice = priceMrp.trim() ? Number.parseFloat(priceMrp) : null;
    if (!priceSelling || !Number.isFinite(regularPrice) || regularPrice <= 0) {
      showToast("Enter a regular price greater than zero.");
      setActiveTab("pricing");
      return;
    }
    if (offerPrice !== null && (!Number.isFinite(offerPrice) || offerPrice <= 0 || offerPrice >= regularPrice)) {
      showToast("Offer price must be greater than zero and lower than the regular price.");
      setActiveTab("pricing");
      return;
    }

    if (!sizeChart.rows.some((row) => row.size.trim())) {
      showToast("Select at least one available size before saving.");
      setActiveTab("basic");
      return;
    }
    if (generatedProductCodes.length !== sizeChart.rows.filter((row) => row.size.trim()).length) {
      showToast("Product codes could not be generated. Check the category, style name, colour and sizes.");
      setActiveTab("basic");
      return;
    }
    if (new Set(generatedProductCodes).size !== generatedProductCodes.length) {
      showToast("Each available size must generate a unique product code. Check the size list.");
      setActiveTab("basic");
      return;
    }
    const invalidStockSize = sizeChart.rows.find((row) => {
      const quantity = stockBySize[row.size];
      return quantity === "" || !Number.isInteger(Number(quantity)) || Number(quantity) < 0;
    });
    if (invalidStockSize) {
      showToast(`Enter a whole number of 0 or more for size ${invalidStockSize.size}.`);
      setActiveTab("basic");
      return;
    }
    if (isTwoPieceProductName(name) && (!images.some((image) => image.tryonRole === "top") || !images.some((image) => image.tryonRole === "bottom"))) {
      showToast("For a two-piece set, mark one separate product photo as Top and another as Bottom.");
      setActiveTab("images");
      return;
    }
    if (isTwoPieceProductName(name) && !images.some((image) => image.tryonRole === "set")) {
      showToast("For a two-piece set, mark one complete outfit photo as Full Look so virtual try-on can apply both pieces together.");
      setActiveTab("images");
      return;
    }
    if (!images.length) {
      showToast("Upload at least one product image before saving.");
      setActiveTab("images");
      return;
    }

    if (isProcessingImageBackground) {
      showToast("Wait for product photo background processing to finish.");
      setActiveTab("images");
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
        product_details: productDetails.trim() || null,
        how_to_style: howToStyle.trim() || null,
        category_id: categoryId || (categories.length > 0 ? String(categories[0].id) : ""),
        gender: gender || "Women",
        size_chart: sizeChart,
        fabric: fabric.trim() || undefined,
        colour: colour.trim() || undefined,
        occasion: occasion.trim() || undefined,
        hem_length: isSkirtProductName(name) ? hemLength || null : null,
        model_path: modelPath.trim(),
        price_selling: offerPrice ?? regularPrice,
        price_mrp: regularPrice,
        is_published: publish,
        is_featured: isFeatured,
        variants: sizeChart.rows
          .filter((row) => row.size.trim())
          .map((row) => ({
            sku: generateProductCode({ category: selectedCategoryName, style: name, colour, size: row.size }),
            size: row.size.trim(),
            stock_qty: Math.max(0, Number.parseInt(stockBySize[row.size] || "0", 10) || 0),
          })),
        images: imageDataUrls.map((url, i) => ({ s3_url: url, display_order: i, tryon_role: images[i].tryonRole || "gallery" })),
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
          <p className="mt-1 text-xs text-muted-foreground"><span className="font-bold text-red-500 text-base">*</span> Required fields must be completed before saving.</p>
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
                    {tab.label}
                    {tab.required && <span aria-label="required section" className="font-bold text-red-500 text-base">*</span>}
                  </div>
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
                    Product Name <span className="font-bold text-red-500 text-base">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    aria-required="true"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Classic Silk Shirt"
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all text-foreground"
                  />
                  <p className="mt-1.5 text-xs text-muted-foreground">Used to create a compact style code; the full product name stays unchanged.</p>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Generated Product Codes <span className="font-bold text-red-500 text-base">*</span>
                    </label>
                    <div aria-live="polite" className="min-h-10 max-h-24 overflow-y-auto rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground">
                      {generatedProductCodes.length
                        ? generatedProductCodes.map((code) => <div key={code} className="font-mono">{code}</div>)
                        : <span className="text-muted-foreground">Choose a category, enter a style name and colour, then select sizes.</span>}
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">Short SKU format: VTX-category initials-style initials-colour code-size (for example, VTX-CS-PCS-PNK-S).</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Category <span className="font-bold text-red-500 text-base">*</span>
                    </label>
                    <select
                      required
                      aria-required="true"
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
                      Department / Gender <span className="font-bold text-red-500 text-base">*</span>
                    </label>
                    <select
                      required
                      aria-required="true"
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
                      Fabric <span className="font-bold text-red-500 text-base">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      aria-required="true"
                      value={fabric}
                      onChange={(e) => setFabric(e.target.value)}
                      placeholder="e.g. Silk, Cotton blend"
                      className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all text-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Colour <span className="font-bold text-red-500 text-base">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      aria-required="true"
                      value={colour}
                      onChange={(e) => setColour(e.target.value)}
                      placeholder="e.g. Ivory, Midnight Blue"
                      className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all text-foreground"
                    />
                  </div>
                </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Occasion <span className="text-xs font-normal text-muted-foreground">(Optional)</span>
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
                {isSkirtProductName(name) && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Skirt length</label>
                    <select
                      value={hemLength}
                      onChange={(e) => setHemLength(e.target.value)}
                      className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all appearance-none text-foreground"
                    >
                      <option value="">Select actual garment length</option>
                      {hemLengthOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                    <p className="mt-1.5 text-xs text-muted-foreground">This records the garment’s actual hem length for staff and shoppers. Use a Bottom photo showing the full hem. Self-hosted FASHN does not receive this as a text prompt.</p>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Description <span className="font-bold text-red-500 text-base">*</span>
                  </label>
                  <textarea
                    rows={5}
                    required
                    aria-required="true"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the product..."
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all resize-none text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Product Details</label>
                  <textarea
                    rows={4}
                    value={productDetails}
                    onChange={(event) => setProductDetails(event.target.value)}
                    placeholder="Add garment construction, fit, care, or other product-specific details..."
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all resize-y text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">How to Style</label>
                  <textarea
                    rows={4}
                    value={howToStyle}
                    onChange={(event) => setHowToStyle(event.target.value)}
                    placeholder="Suggest footwear, accessories, layering, or occasions for this look..."
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all resize-y text-foreground"
                  />
                </div>
              </div>
              <div className="mt-6">
                <SizeChartEditor value={sizeChart} onChange={handleSizeChartChange} stockBySize={stockBySize} onStockChange={setStockBySize} />
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
                      Regular Price (₹) <span className="font-bold text-red-500 text-base">*</span>
                    </label>
                    <input
                      type="number"
                      min="0.01"
                      required
                      aria-required="true"
                      value={priceSelling}
                      onChange={(e) => setPriceSelling(e.target.value)}
                      placeholder="2499.00"
                      className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all text-foreground"
                    />
                    <p className="mt-1.5 text-xs text-muted-foreground">The fixed price charged when no offer is active.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Offer Price (₹) <span className="text-xs font-normal text-muted-foreground">(Optional)</span>
                    </label>
                    <input
                      type="number"
                      value={priceMrp}
                      onChange={(e) => setPriceMrp(e.target.value)}
                      placeholder="Optional discounted price"
                      className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all text-foreground"
                    />
                    <p className="mt-1.5 text-xs text-muted-foreground">Leave blank at the regular price. An offer must be lower than the regular price.</p>
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
                        <span className="mt-0.5 block text-xs font-normal text-muted-foreground">Highlights this product in featured storefront sections.</span>
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
                    Product Images <span className="font-bold text-red-500 text-base">*</span>
                  </h2>
                </div>
                {isProcessingImageBackground ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent bg-accent/10 border border-accent/20 px-2.5 py-1 rounded-full">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Preparing image
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-accent bg-accent/10 border border-accent/20 px-2.5 py-1 rounded-full">
                    {images.length} image{images.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>

              <div className="mb-6">
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
                aria-required="true"
                aria-label="Required product images"
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => imageInputRef.current?.click()}
                className="border-2 border-dashed border-border hover:border-accent/50 bg-background/50 rounded-xl p-10 flex flex-col items-center justify-center text-center transition-all cursor-pointer group hover:bg-accent/5"
              >
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
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Drag cards or use arrow buttons to alter garment display order. <span className="text-accent font-medium">#1 is the primary storefront cover photo.</span>
                      </p>
                      {isTwoPieceProductName(name) && <p className="mt-1 text-[11px] text-muted-foreground">Tag one photo as Top and a separate photo as Bottom. FASHN applies them in sequence; other photos remain gallery images.</p>}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {images.map((img, idx) => (
                      <div
                        key={img.id}
                        draggable
                        onDragStart={(e) => handleCardDragStart(e, idx)}
                        onDragOver={handleCardDragOver}
                        onDrop={(e) => handleCardDrop(e, idx)}
                        className={cn(
                          "relative aspect-square rounded-xl border border-border overflow-hidden group bg-surface-hover transition-all cursor-grab active:cursor-grabbing select-none",
                          draggedImageIndex === idx ? "opacity-30 ring-2 ring-accent scale-95" : "hover:border-accent/40 hover:shadow-lg"
                        )}
                      >
                        <Image width={1200} height={900} unoptimized
                          src={img.preview}
                          alt={`Product ${idx + 1}`}
                          className="w-full h-full object-cover pointer-events-none"
                        />

                        {/* Top Bar Controls */}
                        <div className="absolute top-2 inset-x-2 flex items-center justify-between z-10">
                          <div className="flex items-center gap-1.5">
                            {idx === 0 ? (
                              <span className="bg-accent text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-md">
                                <Star className="w-3 h-3 fill-current" /> PRIMARY
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleMakePrimary(idx)}
                                title="Set as primary cover image"
                                className="bg-black/75 hover:bg-accent text-white text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all shadow-md backdrop-blur-sm"
                              >
                                <Star className="w-3 h-3" /> Set Primary
                              </button>
                            )}
                            <span className="bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full backdrop-blur-sm">
                              #{idx + 1}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveImage(img.id)}
                            title="Remove image"
                            className="w-6 h-6 bg-red-500/90 hover:bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                          >
                            <XIcon className="w-3.5 h-3.5 text-white" />
                          </button>
                        </div>

                        {/* Swap Arrow Controls (Hover Overlay) */}
                        <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 flex items-center justify-between z-10 pointer-events-none">
                          {idx > 0 ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMoveImage(idx, idx - 1);
                              }}
                              title="Move Left (Earlier)"
                              className="pointer-events-auto w-7 h-7 bg-black/80 hover:bg-accent text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-lg backdrop-blur-sm hover:scale-110"
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </button>
                          ) : <div />}

                          {idx < images.length - 1 ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMoveImage(idx, idx + 1);
                              }}
                              title="Move Right (Later)"
                              className="pointer-events-auto w-7 h-7 bg-black/80 hover:bg-accent text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-lg backdrop-blur-sm hover:scale-110 ml-auto"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          ) : <div />}
                        </div>

                        {/* Drag Handle Indicator (Bottom-right hover) */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-40 transition-opacity pointer-events-none">
                          <GripVertical className="w-8 h-8 text-white drop-shadow-md" />
                        </div>

                        {isTwoPieceProductName(name) && (
                          <div className="absolute bottom-10 inset-x-2 z-20 flex gap-1 pointer-events-auto">
                            {(["top", "bottom", "set", "gallery"] as const).map((role) => (
                              <button
                                key={role}
                                type="button"
                                aria-pressed={role !== "gallery" && img.tryonRole === role}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  if (role === "gallery") {
                                    setImages((current) => current.map((image) => image.id === img.id ? { ...image, tryonRole: "gallery" } : image));
                                  } else {
                                    handleSelectTryOnImage(img.id, role);
                                  }
                                }}
                                className={cn(
                                  "flex-1 rounded px-1 py-1 text-[9px] font-semibold uppercase shadow-sm",
                                  img.tryonRole === role ? "bg-accent text-white" : "bg-black/75 text-white hover:bg-black"
                                )}
                              >
                                {role === "gallery" ? "Gallery" : role === "set" ? "Full Look" : role}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* File info footer */}
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-2.5 py-1.5 pointer-events-none">
                          <p className="text-[10px] text-white font-medium truncate">
                            {img.file?.name || `Garment View ${idx + 1}`}
                          </p>
                          <p className="text-[9px] text-white/60">
                            {((img.file?.size || 0) / 1024).toFixed(0)} KB
                          </p>
                        </div>
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
                </div>
              )}


              <AdminTryOnImageGenerator
                productName={name}
                images={images}
                onSelectTopImage={handleSelectTopImage}
                hemLength={hemLength}
                onAddImage={handleGeneratedImage}
              />

            </div>
          )}


          {/* 3D PRODUCT */}
          {activeTab === "3d" && (
            <section className="space-y-8 animate-in fade-in rounded-xl border border-border bg-background/30 p-6">
              {/* Header */}
              <div>
                <div className="mb-2">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">3D Product</h2>
                    <p className="text-xs text-muted-foreground">
                      Upload an existing .glb model or create one from product photos below.
                    </p>
                  </div>
                </div>
              </div>

              {/* 3D Model Section */}
              <div className="mt-8 pt-8 border-t border-border">
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


              {/* Info banner */}
              <div className="bg-accent/5 border border-accent/20 rounded-xl p-4 flex items-start gap-3">
                <div className="text-xs text-muted-foreground leading-relaxed">
                  <span className="font-semibold text-foreground">
                    All three photos are required.
                  </span>{" "}
                  Hunyuan currently builds the model from the front photo;
                  side and back views are collected but do not yet constrain
                  reconstruction. Review the generated model carefully before saving.
                </div>
              </div>

              {/* 3-Photo Upload Grid */}
              <div className="grid grid-cols-3 gap-6">
                <PhotoUploadCard
                  label="Front View *"
                  photo={frontPhoto}
                  inputRef={frontRef}
                  onSelect={(e) => handlePhotoSelect(e, setFrontPhoto)}
                  onClear={() => setFrontPhoto({ file: null, preview: null })}
                  showCameraIcon={false}
                />
                <PhotoUploadCard
                  label="Side View *"
                  photo={sidePhoto}
                  inputRef={sideRef}
                  onSelect={(e) => handlePhotoSelect(e, setSidePhoto)}
                  onClear={() => setSidePhoto({ file: null, preview: null })}
                  showCameraIcon={false}
                />
                <PhotoUploadCard
                  label="Back View *"
                  photo={backPhoto}
                  inputRef={backRef}
                  onSelect={(e) => handlePhotoSelect(e, setBackPhoto)}
                  onClear={() => setBackPhoto({ file: null, preview: null })}
                  showCameraIcon={false}
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
                {(reconstructing || reconstructResult) ? (
                  <p
                    role="status"
                    aria-live="polite"
                    className={`max-w-md text-center text-xs ${reconstructResult ? "text-emerald-600" : "text-muted-foreground"}`}
                  >
                    {reconstructStatus || "Generating your 3D model…"}
                    {reconstructing ? " Keep this page open; the preview will appear automatically when it is ready." : ""}
                  </p>
                ) : null}
                {reconstructError ? (
                  <p
                    role="alert"
                    className="max-w-md rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-xs text-red-700 dark:text-red-300"
                  >
                    3D reconstruction failed: {reconstructError}
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
            </section>
          )}
        </div>
      </div>

      <Product3DModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        product={{
          id: "preview",
          name: name || "Garment 3D Model",
          price: (priceMrp ? parseFloat(priceMrp) : parseFloat(priceSelling)) || 0,
          model3dUrl: modelPath || undefined,
        }}
      />
    </div>
  );
}
