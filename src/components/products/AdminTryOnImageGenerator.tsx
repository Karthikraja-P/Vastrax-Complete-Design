"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { getSession } from "next-auth/react";

interface GalleryImage {
  id: string;
  file: File;
  preview: string;
  tryonRole?: "top" | "bottom" | "gallery" | "set";
}

interface AdminTryOnModel {
  id: string;
  name: string;
  description: string;
  image_url: string;
}

interface Props {
  productName: string;
  images: GalleryImage[];
  hemLength?: string;
  onSelectTopImage: (id: string) => void;
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

export default function AdminTryOnImageGenerator({ productName, images, hemLength, onSelectTopImage, onAddImage }: Props) {
  const twoPieceSet = isTwoPieceSet(productName);
  const selected = images.find((image) => image.tryonRole === "top") || (!twoPieceSet ? images[0] : undefined);
  const bottom = images.find((image) => image.tryonRole === "bottom");
  const [personFile, setPersonFile] = useState<File | null>(null);
  const [models, setModels] = useState<AdminTryOnModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState(
    /\bskirt\b/i.test(productName) ? "skirt-storefront-reference" : "aanya",
  );
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [result, setResult] = useState<{ file: File; url: string } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => { if (result) URL.revokeObjectURL(result.url); }, [result]);

  useEffect(() => {
    let active = true;
    fetch("/api/v1/try-on/admin-models", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load the model library.");
        return response.json() as Promise<AdminTryOnModel[]>;
      })
      .then((availableModels) => {
        if (!active) return;
        setModels(availableModels);
        setSelectedModelId((current) => availableModels.some((model) => model.id === current) ? current : availableModels[0]?.id || "");
        setModelsError(null);
      })
      .catch((caught) => {
        if (active) setModelsError(caught instanceof Error ? caught.message : "Could not load the model library.");
      });
    return () => { active = false; };
  }, []);

  const tryOn = async () => {
    if ((!personFile && !selectedModelId) || !selected || (twoPieceSet && !bottom)) return;
    setProcessing(true);
    setResult(null);
    setError(null);
    try {
      const asFile = async (image: GalleryImage) => {
        if (image.file.size) return image.file;
        const imageResponse = await fetch(image.preview);
        if (!imageResponse.ok) throw new Error("Could not load the selected product photo.");
        const blob = await imageResponse.blob();
        return new File([blob], "product-photo", { type: blob.type || "image/webp" });
      };
      const sourceFile = await asFile(selected);
      const form = new FormData();
      if (personFile) form.append("person_image", personFile);
      else form.append("model_id", selectedModelId);
      if (twoPieceSet) {
        form.append("garment_image", sourceFile);
        form.append("bottom_image", await asFile(bottom!));
        form.append("garment_type", "tops");
      }
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
        <p className="mt-1 text-xs text-muted-foreground">{twoPieceSet ? "Choose separate Top and Bottom photos. FASHN applies each garment in sequence; a complete-set photo can stay in the gallery." : "Choose the product photo to preview on a person."}</p>
      </div>
      {/\bskirt\b|\blehenga\b/i.test(productName) && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-muted-foreground">
          {hemLength ? <>Recorded hem length: <strong className="text-foreground">{({ knee: "Knee length", midi: "Midi length", ankle: "Ankle length", floor: "Floor length" } as Record<string, string>)[hemLength] || hemLength}</strong>. </> : null}
          Check that the Bottom photo shows the whole hem. This length is workflow guidance only; self-hosted FASHN may generate a different hem length.
        </p>
      )}
      {images.length === 0 ? (
        <p className="text-xs text-muted-foreground">Upload product photos above first.</p>
      ) : twoPieceSet ? (
        <div className="grid grid-cols-2 gap-3">
          {[{ label: "Top photo", image: selected }, { label: "Bottom photo", image: bottom }].map(({ label, image }) => (
            <div key={label} className="rounded-lg border border-border p-2">
              <p className="mb-2 text-[10px] font-semibold uppercase text-muted-foreground">{label}</p>
              {image ? <Image src={image.preview} alt={label} width={144} height={168} unoptimized className="h-40 w-full rounded object-contain bg-white" /> : <div className="flex h-40 items-center justify-center rounded bg-surface text-center text-xs text-muted-foreground">Choose this role on its Product Images card</div>}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {images.map((image, index) => (
            <button key={image.id} type="button" onClick={() => { onSelectTopImage(image.id); setResult(null); }} aria-pressed={selected?.id === image.id}
              className={`w-24 shrink-0 rounded-lg border p-1 text-left ${selected?.id === image.id ? "border-accent ring-2 ring-accent/30" : "border-border"}`}>
              <Image src={image.preview} alt={`Product gallery photo ${index + 1}`} width={96} height={112} unoptimized className="h-28 w-full rounded object-contain bg-white" />
              <span className="mt-1 block text-[10px] text-foreground">{selected?.id === image.id ? "Try-on source" : `Photo ${index + 1}`}</span>
            </button>
          ))}
        </div>
      )}
      <div>
        <p className="mb-2 text-xs font-medium text-foreground">Choose a model or upload your own</p>
        {/\bskirt\b/i.test(productName) && models.some((model) => model.id === "skirt-storefront-reference") && (
          <p className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-muted-foreground">
            {personFile || selectedModelId !== "skirt-storefront-reference"
              ? <>A different person photo is selected. In testing, FASHN shortened this skirt on the other model photos. Select <strong className="text-foreground">Storefront skirt reference</strong> for the tested ankle-length result. FASHN cannot guarantee hem length on other models.</>
              : <>The storefront skirt reference is selected. It uses the same green-top person photo as the successful ankle-length storefront result.</>}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {models.map((model) => (
            <button
              key={model.id}
              type="button"
              onClick={() => { setSelectedModelId(model.id); setPersonFile(null); setResult(null); }}
              aria-pressed={!personFile && selectedModelId === model.id}
              className={[
                "rounded-lg border p-2 text-left transition-colors",
                !personFile && selectedModelId === model.id ? "border-accent ring-2 ring-accent/30" : "border-border hover:border-accent/60",
              ].join(" ")}
            >
              <Image src={model.image_url} alt={model.name} width={144} height={168} unoptimized className="h-32 w-full rounded object-cover object-top" />
              <span className="mt-1 block text-xs font-semibold text-foreground">{model.name}</span>
              <span className="mt-0.5 block text-[9px] leading-snug text-muted-foreground">{model.description}</span>
            </button>
          ))}
          <label className={[
            "flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-3 text-center transition-colors",
            personFile ? "border-accent bg-accent/5" : "border-border hover:border-accent/60",
          ].join(" ")}>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-label="Upload your own model photo"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0] || null;
                setPersonFile(file);
                if (file) setSelectedModelId("");
                setResult(null);
              }}
            />
            <Upload className="mb-2 h-6 w-6 text-accent" />
            <span className="text-xs font-semibold text-foreground">{personFile ? "Photo uploaded" : "Upload your photo"}</span>
            <span className="mt-1 break-all text-[9px] leading-snug text-muted-foreground">{personFile ? personFile.name : "JPG, PNG or WEBP · max 10 MB"}</span>
          </label>
        </div>
        {modelsError && <p className="mt-2 text-xs text-amber-700">{modelsError} The upload choice remains available.</p>}
        {personFile && <p className="mt-2 text-xs text-muted-foreground">Your uploaded photo is selected for this preview.</p>}
      </div>
      <button type="button" onClick={tryOn} disabled={!selected || (twoPieceSet && !bottom) || (!personFile && !selectedModelId) || processing} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
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
