"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { getSession } from "next-auth/react";
import { Loader2, Sparkles } from "lucide-react";

export interface ProductImageDraft {
  id: string;
  file?: File;
  preview: string;
  label?: string;
  isExisting?: boolean;
}

interface AdminTryOnImageGeneratorProps {
  images: ProductImageDraft[];
  productName: string;
  onAddImage: (file: File, modelName: string) => void;
}

const models = [
  { id: "aanya", name: "Aanya", description: "Long waves · medium-brown complexion · average build", image: "/api/v1/try-on/admin-models/aanya/image" },
  { id: "meera", name: "Meera", description: "Shoulder-length curls · deep complexion · tall, lean build", image: "/api/v1/try-on/admin-models/meera/image" },
  { id: "kavya", name: "Kavya", description: "Long braid · golden-brown complexion · curvy build", image: "/api/v1/try-on/admin-models/kavya/image" },
] as const;

type GarmentType = "tops" | "bottoms" | "one-pieces";

function inferGarmentType(name: string): GarmentType {
  const value = name.toLowerCase();
  if (/dress|frock|gown|lehenga|one-piece/.test(value)) return "one-pieces";
  if (/top|shirt|tee/.test(value) && /skirt|bottom|set/.test(value)) return "tops";
  if (/skirt|trouser|pant|jean|denim|bottom|palazzo/.test(value)) return "bottoms";
  return "tops";
}

export default function AdminTryOnImageGenerator({ images, productName, onAddImage }: AdminTryOnImageGeneratorProps) {
  const [modelId, setModelId] = useState<string>(models[0].id);
  const [imageId, setImageId] = useState("");
  const [garmentTypeOverride, setGarmentTypeOverride] = useState<GarmentType | null>(null);
  const garmentType = garmentTypeOverride || inferGarmentType(productName);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState<{ file: File; preview: string; modelName: string } | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  const discardPreview = () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setGenerated(null);
  };

  const availableImages = useMemo(() => images.map((image, index) => ({
    ...image,
    label: image.label || image.file?.name || `Product image ${index + 1}`,
  })), [images]);

  const generate = async () => {
    const selectedImage = availableImages.find((image) => image.id === imageId) || availableImages[0];
    const selectedModel = models.find((model) => model.id === modelId);
    if (!selectedImage || !selectedModel) {
      setError("Add a product photo and choose a model first.");
      return;
    }

    setGenerating(true);
    setError(null);
    try {
      let garmentFile = selectedImage.file;
      if (!garmentFile || garmentFile.size === 0) {
        const imageResponse = await fetch(selectedImage.preview);
        if (!imageResponse.ok) throw new Error("Could not load that product image. Upload a local product photo and try again.");
        const blob = await imageResponse.blob();
        const extension = blob.type.includes("png") ? "png" : blob.type.includes("webp") ? "webp" : "jpg";
        garmentFile = new File([blob], `product-image.${extension}`, { type: blob.type || "image/jpeg" });
      }

      let token = localStorage.getItem("vastrax_token");
      if (!token || token === "null" || token === "undefined") {
        const session = await getSession();
        token = session?.accessToken || null;
      }
      const formData = new FormData();
      formData.append("model_id", modelId);
      formData.append("garment_type", garmentType);
      formData.append("garment_image", garmentFile);
      const response = await fetch("/api/v1/try-on/admin-preview", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.detail || result.message || "Try-on preview failed.");
      }
      const resultBlob = await response.blob();
      if (!resultBlob.size) throw new Error("Try-on returned an empty preview image.");
      const resultFile = new File([resultBlob], `try-on-${selectedModel.name.toLowerCase()}-${Date.now()}.png`, {
        type: resultBlob.type || "image/png",
      });
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      const preview = URL.createObjectURL(resultFile);
      previewUrlRef.current = preview;
      setGenerated({ file: resultFile, preview, modelName: selectedModel.name });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Try-on preview failed. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <section className="rounded-xl border border-border bg-background p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" />
          Create a model photo with Virtual Try-On
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Choose a model and product photo. The generated result is added to this product gallery and saved with the product.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {models.map((model) => (
          <button
            key={model.id}
            type="button"
            onClick={() => setModelId(model.id)}
            aria-pressed={modelId === model.id}
            className={`overflow-hidden rounded-lg border text-left transition-colors ${modelId === model.id ? "border-accent ring-2 ring-accent/30" : "border-border hover:border-accent/50"}`}
          >
            <div className="relative aspect-[3/4] bg-white">
              <Image src={model.image} alt={`${model.name} virtual try-on model`} fill unoptimized sizes="(max-width: 640px) 80vw, 220px" className="object-cover object-top" />
            </div>
            <div className="p-3">
              <span className="text-xs font-semibold text-foreground">{model.name}</span>
              <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{model.description}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px_auto] gap-3 items-end">
        <label className="text-xs font-medium text-foreground">
          Product photo to try on
          <select value={availableImages.some((image) => image.id === imageId) ? imageId : (availableImages[0]?.id || "")} onChange={(event) => setImageId(event.target.value)} disabled={!availableImages.length || generating} className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm">
            {availableImages.length ? availableImages.map((image) => <option key={image.id} value={image.id}>{image.label}</option>) : <option value="">Upload a product photo first</option>}
          </select>
        </label>
        <label className="text-xs font-medium text-foreground">
          Garment type
          <select value={garmentType} onChange={(event) => setGarmentTypeOverride(event.target.value as GarmentType)} disabled={generating} className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm">
            <option value="tops">Top</option>
            <option value="bottoms">Bottom</option>
            <option value="one-pieces">Dress / one-piece</option>
          </select>
        </label>
        <button type="button" onClick={generate} disabled={!availableImages.length || generating} className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
          {generating ? <><Loader2 className="h-4 w-4 animate-spin" />Generating…</> : <><Sparkles className="h-4 w-4" />Generate preview</>}
        </button>
      </div>
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      {generated && (
        <div className="flex flex-col gap-4 rounded-lg border border-accent/30 bg-accent/5 p-4 sm:flex-row sm:items-center">
          <Image src={generated.preview} alt={`Virtual try-on preview with ${generated.modelName}`} width={192} height={288} unoptimized className="h-48 w-32 rounded-md bg-white object-contain" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">Preview ready · {generated.modelName}</p>
            <p className="mt-1 text-xs text-muted-foreground">Review the generated fit and garment details, then add it to this product’s gallery.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => { onAddImage(generated.file, generated.modelName); discardPreview(); }} className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white">Add to product images</button>
              <button type="button" onClick={discardPreview} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground">Discard preview</button>
            </div>
          </div>
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">AI previews can alter garment details. Review each result before adding it to the storefront gallery.</p>
    </section>
  );
}