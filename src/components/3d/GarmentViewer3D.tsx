"use client";

import React, { useEffect, useRef, useState } from "react";
import { 
  RotateCw, Pause, Play, RefreshCw, Sun, Moon, 
  Sparkles, Box, Info
} from "lucide-react";

// Safe dynamic tag for Web Component in React 19 / Next.js
const ModelViewer = "model-viewer" as any;

interface GarmentViewer3DProps {
  src: string;
  alt?: string;
  poster?: string;
  autoRotate?: boolean;
  className?: string;
  badgeTitle?: string;
  showControls?: boolean;
  onClose?: () => void;
}

export function GarmentViewer3D({
  src,
  alt = "3D Garment View",
  poster,
  autoRotate = true,
  className = "",
  badgeTitle = "Hunyuan3D-2.1 PBR Mesh",
  showControls = true,
}: GarmentViewer3DProps) {
  const viewerRef = useRef<any>(null);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [isRotating, setIsRotating] = useState(autoRotate);
  const [lightingIndex, setLightingIndex] = useState(0);
  const [backdropIndex, setBackdropIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Lighting presets
  const lightingPresets = [
    { name: "Studio", exposure: 1.05, shadow: 0.8 },
    { name: "Bright", exposure: 1.3, shadow: 0.5 },
    { name: "Dramatic", exposure: 0.85, shadow: 1.2 },
  ];

  // Backdrop presets
  const backdrops = [
    { name: "Obsidian", bg: "radial-gradient(circle at 50% 35%, #181d28 0%, #090b10 100%)" },
    { name: "Cyber Dark", bg: "radial-gradient(circle at 50% 30%, #1c1c1c 0%, #0a0a0a 100%)" },
    { name: "Studio Slate", bg: "radial-gradient(circle at 50% 30%, #2e384d 0%, #151a24 100%)" },
  ];

  // Load model-viewer script dynamically
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (customElements.get("model-viewer")) {
      setIsScriptLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.type = "module";
    script.src = "https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js";
    script.onload = () => setIsScriptLoaded(true);
    document.head.appendChild(script);
  }, []);

  // Sync rotation state with viewer element
  const toggleRotation = () => {
    if (!viewerRef.current) return;
    const next = !isRotating;
    viewerRef.current.autoRotate = next;
    setIsRotating(next);
  };

  // Reset camera view
  const resetCamera = () => {
    if (!viewerRef.current) return;
    viewerRef.current.cameraOrbit = "0deg 75deg 4.0m";
    viewerRef.current.cameraTarget = "0m 0m 0m";
    viewerRef.current.fieldOfView = "40deg";
  };

  // Cycle lighting
  const cycleLighting = () => {
    if (!viewerRef.current) return;
    const nextIdx = (lightingIndex + 1) % lightingPresets.length;
    const preset = lightingPresets[nextIdx];
    viewerRef.current.exposure = preset.exposure;
    viewerRef.current.shadowIntensity = preset.shadow;
    setLightingIndex(nextIdx);
  };

  // Cycle backdrop
  const cycleBackdrop = () => {
    setBackdropIndex((prev) => (prev + 1) % backdrops.length);
  };

  return (
    <div 
      className={`relative w-full h-full rounded-[2rem] overflow-hidden flex flex-col items-center justify-center select-none transition-all duration-300 ${className}`}
      style={{ background: backdrops[backdropIndex].bg }}
    >
      {/* Top Header Badge */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2.5 bg-black/60 dark:bg-white/10 backdrop-blur-xl border border-white/10 px-3.5 py-1.5 rounded-full shadow-lg pointer-events-none">
        <div className="w-2 h-2 rounded-full bg-[#38bdf8] animate-pulse" />
        <span className="text-[11px] font-bold tracking-wider uppercase text-white/90">
          3D Interactive
        </span>
        <span className="text-[10px] text-white/50 border-l border-white/20 pl-2">
          {badgeTitle}
        </span>
      </div>

      {/* Stats Pill (Top Right) */}
      <div className="absolute top-4 right-4 z-20 hidden sm:flex items-center gap-3 bg-black/60 dark:bg-white/10 backdrop-blur-xl border border-white/10 px-3 py-1.5 rounded-xl shadow-lg pointer-events-none text-[11px] text-white/80">
        <span className="text-white/50">Mesh:</span>
        <span className="font-semibold text-[#38bdf8]">50K Poly</span>
        <span className="text-white/20">|</span>
        <span className="text-white/50">Texture:</span>
        <span className="font-semibold text-[#e07a3f]">2K PBR</span>
      </div>

      {/* Model Viewer Web Component */}
      {isScriptLoaded ? (
        <ModelViewer
          ref={viewerRef}
          src={src}
          poster={poster}
          alt={alt}
          camera-controls="true"
          touch-action="pan-y"
          auto-rotate={autoRotate ? "true" : undefined}
          auto-rotate-delay="800"
          rotation-per-second="22deg"
          shadow-intensity="0.8"
          shadow-softness="0.7"
          environment-image="neutral"
          exposure={lightingPresets[lightingIndex].exposure}
          camera-orbit="0deg 75deg 4.0m"
          camera-target="0m 0m 0m"
          field-of-view="40deg"
          interaction-prompt="none"
          onLoad={() => setIsLoading(false)}
          style={{ width: "100%", height: "100%", outline: "none", cursor: "grab" }}
        />
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 text-white/60">
          <div className="w-8 h-8 border-2 border-white/20 border-t-[#e07a3f] rounded-full animate-spin" />
          <span className="text-xs font-medium tracking-wide">Initializing 3D Engine...</span>
        </div>
      )}

      {/* Floating Interaction Hint */}
      <div className="absolute bottom-16 sm:bottom-20 left-1/2 -translate-x-1/2 z-10 pointer-events-none opacity-80 transition-opacity">
        <span className="px-3.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[10px] text-white/70 tracking-wide flex items-center gap-1.5 shadow-md">
          <RotateCw className="w-2.5 h-2.5 text-[#38bdf8]" />
          Drag 360° • Scroll to Zoom • Right Click to Pan
        </span>
      </div>

      {/* Bottom Floating Controls Toolbar */}
      {showControls && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 sm:gap-2 bg-black/70 backdrop-blur-2xl border border-white/15 px-3 py-2 rounded-full shadow-2xl">
          {/* Play/Pause Auto-rotate */}
          <button
            type="button"
            onClick={toggleRotation}
            title={isRotating ? "Pause Rotation" : "Start Rotation"}
            className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
          >
            {isRotating ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span className="hidden md:inline">{isRotating ? "Pause" : "Rotate"}</span>
          </button>

          {/* Reset Camera */}
          <button
            type="button"
            onClick={resetCamera}
            title="Reset Camera View"
            className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Reset</span>
          </button>

          {/* Lighting Mode */}
          <button
            type="button"
            onClick={cycleLighting}
            title="Toggle Lighting Preset"
            className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Sun className="w-3.5 h-3.5 text-amber-300" />
            <span className="hidden md:inline">{lightingPresets[lightingIndex].name}</span>
          </button>

          {/* Backdrop Mode */}
          <button
            type="button"
            onClick={cycleBackdrop}
            title="Toggle Background Backdrop"
            className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Moon className="w-3.5 h-3.5 text-indigo-300" />
            <span className="hidden md:inline">Theme</span>
          </button>
        </div>
      )}
    </div>
  );
}
