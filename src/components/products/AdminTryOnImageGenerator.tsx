"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { getSession } from "next-auth/react";
import { Loader2, Sparkles } from "lucide-react";

interface AdminTryOnImageGeneratorProps {
  productName: string;
  onAddImage: (file: File, modelName: string) => void;
}

const models = [
  { id: "aanya", name: "Aanya", description: "Long waves · medium-brown complexion · average build", image: "/api/v1/try-on/admin-models/aanya/image" },
  { id: "meera", name: "Meera", description: "Shoulder-length curls · deep complexion · tall, lean build", image: "/api/v1/try-on/admin-models/meera/image" },
  { id: "kavya", name: "Kavya", description: "Long braid · golden-brown complexion · curvy build", image: "/api/v1/try-on/admin-models/kavya/image" },
] as const;

type GarmentType = "tops" | "bottoms" | "one-pieces";

function isTwoPieceSet(name: string): boolean {
  return /\bcoord(?:inate)?\b|\bco[- ]?ord\b|\btwo[- ]?piece\b|\b2[- ]?piece\b|\bset\b|skirt\s*(?:and|&)\s*top|top\s*(?:and|&)\s*skirt/i.test(name);
}

function inferGarmentType(name: string): GarmentType {
  const value = name.toLowerCase();
  if (/dress|frock|gown|lehenga|one-piece/.test(value)) return "one-pieces";
  if (/skirt|trouser|pant|jean|denim|bottom|palazzo/.test(value)) return "bottoms";
  return "tops";
}

export default function AdminTryOnImageGenerator({ productName, onAddImage }: AdminTryOnImageGeneratorProps) {
  const twoPieceSet = isTwoPieceSet(productName);
  const [modelId, setModelId] = useState<string>(models[0].id);
  const [garmentFile, setGarmentFile] = useState<File | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const effectivePreviewMode = twoPieceSet ? "set" : "single";
  const garmentType = inferGarmentType(productName);
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

  const generate = async () => {
    const selectedModel = models.find((model) => model.id === modelId);
    if (!selectedModel || !garmentFile) {
      setError("Upload an outfit photo and choose a model first.");
      return;
    }

    setGenerating(true);
    setError(null);
    try {
      let token = localStorage.getItem("vastrax_token");
      if (!token || token === "null" || token === "undefined") {
        const session = await getSession();
        token = session?.accessToken || null;
      }
      const formData = new FormData();
      formData.append("model_id", modelId);
      if (effectivePreviewMode === "set") {
        formData.append("set_image", garmentFile);
      } else {
        formData.append("garment_type", garmentType);
        formData.append("garment_image", garmentFile);
      }
      const response = await fetch("/api/v1/try-on/admin-preview", {
        method: "POST",
        headers: token ? { Authorization: "Bearer " + token } : {},
        body: formData,
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.detail || result.message || "Try-on preview failed.");
      }
      const resultBlob = await response.blob();
      if (!resultBlob.size) throw new Error("Try-on returned an empty preview image.");
      const resultFile = new File([resultBlob], "try-on-" + selectedModel.name.toLowerCase() + "-" + Date.now() + ".png", {
        type: resultBlob.type || "image/png",
      });
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      const preview = URL.createObjectURL(resultFile);
      previewUrlRef.current = preview;
      setGenerated({ file: resultFile, preview, modelName: effectivePreviewMode === "set" ? selectedModel.name + " · top + bottom" : selectedModel.name });
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
          Choose a model, upload a product photo, and generate a preview. The generated result can be added to the product gallery.
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

      <input ref={uploadInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => setGarmentFile(event.target.files?.[0] || null)} />
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => uploadInputRef.current?.click()} disabled={generating} className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-surface-hover disabled:opacity-50">
          Upload outfit photo
        </button>
        {garmentFile && <span className="max-w-full truncate text-xs text-muted-foreground">{garmentFile.name}</span>}
        <button type="button" onClick={generate} disabled={!garmentFile || generating} className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
          {generating ? <><Loader2 className="h-4 w-4 animate-spin" />Generating…</> : <><Sparkles className="h-4 w-4" />Generate</>}
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
