"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, RefreshCw, Sun, Moon } from "lucide-react";

interface GarmentViewer3DProps {
  src: string;
  alt?: string;
  poster?: string;
  autoRotate?: boolean;
  className?: string;
  badgeTitle?: string;
  showControls?: boolean;
  showInteractionHint?: boolean;
  showBadge?: boolean;
  onClose?: () => void;
}

export function GarmentViewer3D({
  src,
  alt = "3D Garment View",
  poster,
  autoRotate = true,
  className = "",
  badgeTitle = "Garment Preview",
  showControls = true,
  showInteractionHint = false,
  showBadge = false,
}: GarmentViewer3DProps) {
  const viewerRef = useRef<HTMLModelViewerElement | null>(null);
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
    { name: "Studio White", bg: "radial-gradient(circle at 50% 30%, #ffffff 0%, #f5f5f5 100%)" },
    { name: "Warm White", bg: "radial-gradient(circle at 50% 30%, #ffffff 0%, #f7f4ef 100%)" },
    { name: "Soft Gray", bg: "radial-gradient(circle at 50% 30%, #ffffff 0%, #eeeeee 100%)" },
  ];

  // Load model-viewer script dynamically with fallback
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (customElements.get("model-viewer")) {
      void Promise.resolve().then(() => setIsScriptLoaded(true));
      return;
    }

    const script = document.createElement("script");
    script.type = "module";
    script.src = "/js/model-viewer.min.js";
    script.onload = () => {
      customElements.whenDefined("model-viewer").then(() => setIsScriptLoaded(true));
    };
    script.onerror = () => {
      const fallback = document.createElement("script");
      fallback.type = "module";
      fallback.src = "https://cdn.jsdelivr.net/npm/@google/model-viewer@3.5.0/dist/model-viewer.min.js";
      fallback.onload = () => {
        customElements.whenDefined("model-viewer").then(() => setIsScriptLoaded(true));
      };
      document.head.appendChild(fallback);
    };
    document.head.appendChild(script);
  }, []);

  // Listen to native model-viewer DOM events
  useEffect(() => {
    const el = viewerRef.current;
    if (!el) return;

    const handleLoad = () => setIsLoading(false);
    const handleError = () => setIsLoading(false);

    el.addEventListener("load", handleLoad);
    el.addEventListener("error", handleError);

    // Safety timeout: dismiss loading overlay after 1.5s
    const timer = setTimeout(() => setIsLoading(false), 1500);

    return () => {
      el.removeEventListener("load", handleLoad);
      el.removeEventListener("error", handleError);
      clearTimeout(timer);
    };
  }, [src, isScriptLoaded]);

  // Sync rotation state with viewer element
  const toggleRotation = () => {
    if (!viewerRef.current) return;
    const next = !isRotating;
    viewerRef.current.autoRotate = next;
    setIsRotating(next);
  };


  // Reset camera view to auto-framed center
  const resetCamera = () => {
    if (!viewerRef.current) return;
    viewerRef.current.cameraOrbit = "auto auto auto";
    viewerRef.current.cameraTarget = "auto auto auto";
    viewerRef.current.fieldOfView = "auto";
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

      {/* Model Viewer Web Component */}
      {isScriptLoaded ? (
        <>
          <model-viewer
            ref={viewerRef}
            src={src}
            poster={poster}
            alt={alt}
            camera-controls="true"
            touch-action="pan-y"
            auto-rotate={autoRotate ? "true" : undefined}
            auto-rotate-delay="500"
            rotation-per-second="20deg"
            shadow-intensity="1.0"
            shadow-softness="0.6"
            bounds="tight"
            environment-image="neutral"
            exposure={lightingPresets[lightingIndex].exposure}
            interaction-prompt="none"
            onLoad={() => setIsLoading(false)}
            onError={(e) => {
              console.warn("ModelViewer load event notice:", e);
              setIsLoading(false);
            }}
            style={{ width: "100%", height: "100%", outline: "none", cursor: "grab" }}
          />
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/40 backdrop-blur-xs z-15 pointer-events-none">
              <div className="w-8 h-8 border-2 border-white/20 border-t-[#38bdf8] rounded-full animate-spin" />
              <span className="text-xs font-medium text-white/80 tracking-wide">Loading 3D Garment Mesh…</span>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 text-white/60">
          <div className="w-8 h-8 border-2 border-white/20 border-t-[#e07a3f] rounded-full animate-spin" />
          <span className="text-xs font-medium tracking-wide">Initializing 3D Engine...</span>
        </div>
      )}

      {showBadge && <div className="absolute top-4 left-4 z-20 rounded-full bg-black/60 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white/90">{badgeTitle}</div>}
      {showInteractionHint && <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-10 rounded-full bg-black/60 px-3 py-1 text-[10px] text-white/70">Drag to rotate</div>}
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
