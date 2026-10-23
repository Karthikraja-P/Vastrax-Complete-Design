"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { getSession } from "next-auth/react";

interface GalleryImage {
  id: string;
  file: File;
  preview: string;
  tryonRole?: "top" | "bottom" | "gallery" | "set";
}

interface Props {
  productName: string;
  images: GalleryImage[];
  onSelectSetImage: (id: string) => void;
  onAddImage: (file: File, modelName: string) => void;
}

function isTwoPieceSet(name: string): boolean {
  return /\bcoord(?:inate)?\b|\bco[- ]?ord\b|\btwo[- ]?piece\b|\b2[- ]?piece\b|\bset\b|skirt\s*(?:and|&)\s*top|top\s*(?:and|&)\s*skirt/i.test(name);
}

function garmentType(name: string): "tops" | "bottoms" | "one-pieces" {
  if (/dress|frock|gown|lehenga|one-piece/i.test(name)) return "one-pieces";
  if (/skirt|trouser|pant|jean|bottom|palazzo/i.test(name)) return "bottoms";
  return "tops";
}

export default function AdminTryOnImageGenerator({ productName, images, onSelectSetImage, onAddImage }: Props) {
  const twoPieceSet = isTwoPieceSet(productName);
  const selected = images.find((image) => image.tryonRole === "set");
  const [personFile, setPersonFile] = useState<File | null>(null);
  const [result, setResult] = useState<{ file: File; url: string } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => { if (result) URL.revokeObjectURL(result.url); }, [result]);

  const tryOn = async () => {
    if (!personFile || !selected) return;
    setProcessing(true);
    setResult(null);
    setError(null);
    try {
      let sourceFile = selected.file;
      if (!sourceFile.size) {
        const imageResponse = await fetch(selected.preview);
        if (!imageResponse.ok) throw new Error("Could not load the selected product photo.");
        const blob = await imageResponse.blob();
        sourceFile = new File([blob], "product-photo", { type: blob.type || "image/webp" });
      }
      const form = new FormData();
      form.append("person_image", personFile);
      if (twoPieceSet) form.append("set_image", sourceFile);
      else {
        form.append("garment_image", sourceFile);
        form.append("garment_type", garmentType(productName));
      }
      let token = localStorage.getItem("vastrax_token");
      if (!token || token === "null" || token === "undefined") token = (await getSession())?.accessToken || null;
      const response = await fetch("/api/v1/try-on/admin-preview", {
        method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body: form,
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.detail || body.message || "Virtual try-on failed.");
      }
      const blob = await response.blob();
      if (!blob.size) throw new Error("Virtual try-on returned no image.");
      const file = new File([blob], `virtual-try-on-${Date.now()}.png`, { type: blob.type || "image/png" });
      setResult({ file, url: URL.createObjectURL(file) });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Virtual try-on failed.");
    } finally {
      setProcessing(false);
    }
  };

  const addResult = async () => {
    if (!result) return;
    setSaving(true);
    setError(null);
    try {
      onAddImage(result.file, "admin preview");
      setResult(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not add the preview.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-4 rounded-xl border border-border bg-background p-5">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Virtual Try-On</h3>
        <p className="mt-1 text-xs text-muted-foreground">Choose the actual complete outfit photo from this product’s gallery, then upload a person photo to test the fit. The result is a preview until you add it.</p>
      </div>
      {images.length === 0 ? (
        <p className="text-xs text-muted-foreground">Upload product photos above first.</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {images.map((image, index) => (
            <button key={image.id} type="button" onClick={() => { onSelectSetImage(image.id); setResult(null); }} aria-pressed={selected?.id === image.id}
              className={`w-24 shrink-0 rounded-lg border p-1 text-left ${selected?.id === image.id ? "border-accent ring-2 ring-accent/30" : "border-border"}`}>
              <Image src={image.preview} alt={`Product gallery photo ${index + 1}`} width={96} height={112} unoptimized className="h-28 w-full rounded object-contain bg-white" />
              <span className="mt-1 block text-[10px] text-foreground">{selected?.id === image.id ? "Try-on source" : `Photo ${index + 1}`}</span>
            </button>
          ))}
        </div>
      )}
      {selected && <p className="text-xs text-muted-foreground">Select a photo showing the full top and bottom together, then save the product. This photo will also be used in the customer fitting room.</p>}
      <label className="block text-xs font-medium text-foreground">Person photo
        <input type="file" accept="image/jpeg,image/png,image/webp" className="mt-2 block w-full text-xs text-foreground" onChange={(event) => { setPersonFile(event.target.files?.[0] || null); setResult(null); }} />
      </label>
      {personFile && <p className="text-xs text-muted-foreground">Selected: {personFile.name}</p>}
      <button type="button" onClick={tryOn} disabled={!selected || !personFile || processing} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
        {processing && <Loader2 className="h-4 w-4 animate-spin" />}{processing ? "Trying on…" : "Try on this outfit"}
      </button>
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      {result && <div className="space-y-3 rounded-lg border border-accent/30 p-4">
        <Image src={result.url} alt="Virtual try-on result" width={240} height={320} unoptimized className="max-h-80 w-auto rounded bg-white object-contain" />
        <p className="text-xs text-muted-foreground">Check the top, bottom, length, and fabric before publishing this image.</p>
        <div className="flex gap-2">
          <button type="button" onClick={addResult} disabled={saving} className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{saving ? "Adding…" : "Add to product images"}</button>
          <button type="button" onClick={() => setResult(null)} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground">Discard</button>
        </div>
      </div>}
    </section>
  );
}
