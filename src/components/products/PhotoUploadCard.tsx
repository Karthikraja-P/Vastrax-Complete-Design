"use client";

import type { ChangeEvent, RefObject } from "react";
import Image from "next/image";
import { Camera, Check, X as XIcon } from "lucide-react";

interface PhotoUploadValue {
  file: File | null;
  preview: string | null;
}

interface PhotoUploadCardProps {
  label: string;
  photo: PhotoUploadValue;
  inputRef: RefObject<HTMLInputElement | null>;
  onSelect: (event: ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
}

export default function PhotoUploadCard({ label, photo, inputRef, onSelect, onClear }: PhotoUploadCardProps) {
  return (
    <div className="flex flex-col items-center">
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onSelect} />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={`relative w-full aspect-[3/4] rounded-xl border-2 border-dashed transition-all overflow-hidden group ${photo.preview ? "border-accent/40 bg-accent/5" : "border-border hover:border-accent/50 bg-background/50"}`}
      >
        {photo.preview ? (
          <>
            <Image src={photo.preview} alt={label} fill unoptimized sizes="(max-width: 768px) 33vw, 240px" className="object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Camera className="w-6 h-6 text-white" />
            </div>
            <button
              type="button"
              onClick={(event) => { event.stopPropagation(); onClear(); }}
              className="absolute top-2 right-2 w-6 h-6 bg-red-500/90 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label={`Remove ${label.toLowerCase()} image`}
            >
              <XIcon className="w-3.5 h-3.5 text-white" />
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-4">
            <div className="w-12 h-12 rounded-full bg-surface border border-border flex items-center justify-center group-hover:scale-110 transition-transform">
              <Camera className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-colors" />
            </div>
            <span className="text-xs text-muted-foreground font-medium">Click to upload</span>
          </div>
        )}
      </button>
      <span className={`mt-2.5 text-xs font-bold uppercase tracking-wider ${photo.preview ? "text-accent" : "text-muted-foreground"}`}>
        {label}
        {photo.preview && <Check className="inline w-3.5 h-3.5 ml-1.5 text-emerald-500" />}
      </span>
    </div>
  );
}
