"use client";

import { useState } from "react";
import { Sparkles, Video, Play, RefreshCw, Upload, Image as ImageIcon } from "lucide-react";
import { motion } from "framer-motion";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export function AiVideoGenerator() {
  const [prompt, setPrompt] = useState("Create a slow, elegant fashion-model rotation showcasing the blue shirt from different angles in a premium luxury studio environment with smooth cinematic camera movement.");
  const [isGenerating, setIsGenerating] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const handleGenerate = () => {
    setIsGenerating(true);
    // Simulate generation delay
    setTimeout(() => {
      setIsGenerating(false);
      setVideoUrl("https://assets.mixkit.co/videos/preview/mixkit-fashion-model-walking-in-a-studio-34676-large.mp4");
    }, 4000);
  };

  return (
    <div className="space-y-8 animate-in fade-in">
      <div>
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-2">
          Generate AI Video <Sparkles className="w-4 h-4 text-accent" />
        </h2>
        <p className="text-sm text-muted-foreground">
          Turn your static product images into cinematic showcases using our Kling AI integration.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Configuration */}
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-foreground mb-3">Reference Images</label>
            <div className="flex gap-4 overflow-x-auto pb-2">
              <div className="w-24 h-24 rounded-lg border-2 border-accent border-solid overflow-hidden flex-shrink-0 relative">
                <img src="https://images.unsplash.com/photo-1598033129183-c4f50c736f10?q=80&w=200" alt="Ref 1" className="w-full h-full object-cover" />
                <div className="absolute top-1 right-1 bg-accent text-accent-foreground text-[10px] px-1.5 py-0.5 rounded-sm font-bold">Main</div>
              </div>
              <div className="w-24 h-24 rounded-lg border border-border border-dashed flex flex-col items-center justify-center text-muted-foreground hover:border-accent hover:text-accent cursor-pointer transition-colors flex-shrink-0 bg-surface-hover">
                <Upload className="w-5 h-5 mb-1" />
                <span className="text-xs">Add Ref</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Animation Prompt</label>
            <textarea 
              rows={4} 
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all resize-none text-foreground" 
            />
            <div className="flex gap-2 mt-2">
              <button onClick={() => setPrompt("Create a dramatic 360-degree rotation with low key lighting emphasizing the fabric texture.")} className="text-xs px-2 py-1 bg-surface-hover hover:bg-border rounded text-muted-foreground hover:text-foreground transition-colors">
                Dramatic 360
              </button>
              <button onClick={() => setPrompt("Showcase the garment in a bright, airy runway setting with a subtle slow-motion walking animation.")} className="text-xs px-2 py-1 bg-surface-hover hover:bg-border rounded text-muted-foreground hover:text-foreground transition-colors">
                Runway Walk
              </button>
            </div>
          </div>

          <button 
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full py-3 bg-accent hover:bg-accent-hover text-accent-foreground rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" /> Generating...
              </>
            ) : (
              <>
                <Video className="w-5 h-5" /> Generate Cinematic Video
              </>
            )}
          </button>
        </div>

        {/* Right Column: Preview/Result */}
        <div className="bg-background border border-border rounded-xl flex flex-col overflow-hidden min-h-[400px]">
          <div className="px-4 py-3 border-b border-border bg-surface flex justify-between items-center">
            <span className="text-sm font-medium text-foreground">Generation Preview</span>
            {videoUrl && (
              <div className="flex gap-2">
                <button className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">Replace Main Media</button>
              </div>
            )}
          </div>
          
          <div className="flex-1 flex items-center justify-center relative p-4">
            {isGenerating ? (
              <div className="flex flex-col items-center justify-center w-full h-full">
                <div className="relative w-full max-w-sm h-2 bg-surface-hover rounded-full overflow-hidden mb-4 border border-border">
                  <motion.div 
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 4, ease: "linear" }}
                    className="absolute top-0 left-0 h-full bg-accent"
                  />
                </div>
                <p className="text-accent animate-pulse font-medium">Processing frames (ETA: 0:15)</p>
              </div>
            ) : videoUrl ? (
              <div className="relative w-full h-full rounded-lg overflow-hidden group border border-border">
                <video 
                  src={videoUrl} 
                  className="w-full h-full object-cover"
                  autoPlay
                  loop
                  muted
                />
                <div className="absolute inset-0 bg-background/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button className="w-16 h-16 bg-background/80 backdrop-blur rounded-full flex items-center justify-center text-foreground hover:scale-110 transition-transform">
                    <Play className="w-6 h-6 ml-1 text-accent" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <div className="w-20 h-20 bg-surface-hover rounded-full flex items-center justify-center mx-auto mb-4 border border-border">
                  <Video className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">Ready to generate.</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Video will appear here once complete.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
