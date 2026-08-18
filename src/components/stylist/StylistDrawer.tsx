"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Sparkles, X, Send, Bot, User, ArrowRight, 
  Shirt, RefreshCcw, Loader2, CheckCircle2, MessageSquare
} from "lucide-react";
import { chatApi, tryonApi } from "@/lib/api";
import { VirtualTryOnModal } from "@/components/products/VirtualTryOnModal";

interface Message {
  id: string;
  sender: "user" | "stylist";
  text: string;
  timestamp: string;
  suggestedProducts?: {
    name: string;
    price: string;
    image: string;
    category: string;
  }[];
}

const initialMessages: Message[] = [
  {
    id: "m-1",
    sender: "stylist",
    text: "Welcome to VASTRAX Concierge. I am your personal AI Haute Couture Stylist. How may I tailor your aesthetic today?",
    timestamp: "Just now",
    suggestedProducts: [
      {
        name: "Noir Silk Evening Blazer",
        price: "$480.00",
        image: "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?q=80&w=400&auto=format&fit=crop",
        category: "tops"
      },
      {
        name: "Minimalist Cashmere Turtleneck",
        price: "$380.00",
        image: "https://images.unsplash.com/photo-1624542313043-30df84aee15d?q=80&w=400&auto=format&fit=crop",
        category: "tops"
      }
    ]
  }
];

const samplePrompts = [
  "Curate a minimalist evening gala outfit",
  "How to style the Silk Evening Blazer?",
  "Recommend monochrome autumn essentials",
  "Pairing suggestions for Cashmere Turtleneck"
];

interface StylistDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function StylistDrawer({ isOpen, onClose }: StylistDrawerProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [vtoProduct, setVtoProduct] = useState<{ name: string; image: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSend = async (textToSend?: string) => {
    const query = textToSend || input;
    if (!query.trim() || isTyping) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      sender: "user",
      text: query,
      timestamp: "Just now"
    };

    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    try {
      const replyText = await chatApi.sendMessage(query);
      const stylistMsg: Message = {
        id: `s-${Date.now()}`,
        sender: "stylist",
        text: replyText,
        timestamp: "Just now",
        suggestedProducts: [
          {
            name: "Silk Crepe Tailored Trousers",
            price: "$320.00",
            image: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?q=80&w=400&auto=format&fit=crop",
            category: "bottoms"
          }
        ]
      };
      setMessages(prev => [...prev, stylistMsg]);
    } catch {
      const fallbackMsg: Message = {
        id: `s-${Date.now()}`,
        sender: "stylist",
        text: "For a refined architectural silhouette, pair structured tailored blazers with fluid silk bottoms and matte leather accents.",
        timestamp: "Just now"
      };
      setMessages(prev => [...prev, fallbackMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 transition-opacity"
            />

            {/* Slide-over Drawer */}
            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-[#111214] border-l border-white/10 shadow-2xl flex flex-col overflow-hidden text-[#ededed]"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#141518]">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-accent to-[#e2733d] flex items-center justify-center shadow-[0_0_12px_rgba(224,122,63,0.4)]">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm tracking-tight text-white flex items-center gap-2">
                      VASTRAX AI Stylist
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    </h3>
                    <p className="text-[11px] text-muted-foreground">Claude 3.5 Haute Couture Concierge</p>
                  </div>
                </div>

                <button 
                  onClick={onClose}
                  className="p-2 rounded-full hover:bg-white/5 text-muted-foreground hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Message Flow */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {messages.map((msg) => (
                  <div 
                    key={msg.id}
                    className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
                  >
                    <div className="flex items-start gap-2.5 max-w-[88%]">
                      {msg.sender === "stylist" && (
                        <div className="w-6 h-6 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center text-accent shrink-0 mt-1">
                          <Bot className="w-3.5 h-3.5" />
                        </div>
                      )}
                      
                      <div>
                        <div 
                          className={`p-4 rounded-2xl text-sm leading-relaxed ${
                            msg.sender === "user"
                              ? "bg-accent text-white rounded-tr-none shadow-[0_0_15px_rgba(224,122,63,0.25)]"
                              : "bg-[#18191d] border border-white/5 text-zinc-200 rounded-tl-none"
                          }`}
                        >
                          {msg.text}
                        </div>

                        {/* Suggested Products attached to message */}
                        {msg.suggestedProducts && msg.suggestedProducts.length > 0 && (
                          <div className="mt-3 space-y-2">
                            <p className="text-[10px] uppercase font-bold tracking-wider text-accent flex items-center gap-1">
                              <Sparkles className="w-3 h-3" /> Recommended Silhouettes
                            </p>
                            <div className="grid grid-cols-2 gap-2.5">
                              {msg.suggestedProducts.map((p, idx) => (
                                <div 
                                  key={idx}
                                  className="bg-black/40 border border-white/5 rounded-xl p-2.5 flex flex-col justify-between hover:border-accent/40 transition-colors group"
                                >
                                  <div className="aspect-square rounded-lg overflow-hidden bg-white/5 mb-2 relative">
                                    <img src={p.image} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                  </div>
                                  <h5 className="text-xs font-semibold text-white truncate">{p.name}</h5>
                                  <p className="text-[11px] text-accent font-bold mt-0.5">{p.price}</p>
                                  <button 
                                    onClick={() => setVtoProduct({ name: p.name, image: p.image })}
                                    className="mt-2 w-full py-1.5 rounded bg-accent/15 hover:bg-accent text-accent hover:text-white text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1"
                                  >
                                    <Shirt className="w-3 h-3" /> Try On
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {isTyping && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
                    <span>Stylist is crafting your recommendation...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Sample Prompts */}
              <div className="px-6 py-2 border-t border-white/5 bg-[#141518]/50 overflow-x-auto whitespace-nowrap scrollbar-none flex gap-2">
                {samplePrompts.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(prompt)}
                    className="px-3 py-1 rounded-full bg-white/5 hover:bg-white/10 text-[11px] text-zinc-300 transition-colors border border-white/5 shrink-0"
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              {/* Input Bar */}
              <div className="p-4 border-t border-white/5 bg-[#141518]">
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSend();
                  }}
                  className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-full px-4 py-2 focus-within:border-accent transition-colors"
                >
                  <input 
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask your stylist anything about fit, color, or occasions..."
                    className="flex-1 bg-transparent text-sm text-white placeholder:text-muted-foreground/60 focus:outline-none"
                  />
                  <button 
                    type="submit"
                    disabled={!input.trim() || isTyping}
                    className="w-8 h-8 rounded-full bg-accent hover:bg-accent/90 disabled:opacity-40 text-white flex items-center justify-center transition-all shadow-[0_0_10px_rgba(224,122,63,0.3)] shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Floating Concierge Launch Button */}
      {!isOpen && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          onClick={() => {
            const ev = new CustomEvent("open-stylist");
            window.dispatchEvent(ev);
          }}
          className="fixed bottom-6 right-6 z-40 px-4 py-3 rounded-full bg-gradient-to-r from-accent to-[#e2733d] text-white font-medium text-xs uppercase tracking-wider flex items-center gap-2 shadow-[0_0_25px_rgba(224,122,63,0.5)] hover:scale-105 transition-all"
        >
          <Sparkles className="w-4 h-4" />
          <span>Stylist Concierge</span>
        </motion.button>
      )}

      {/* Try-on Modal triggered from chat */}
      {vtoProduct && (
        <VirtualTryOnModal 
          isOpen={!!vtoProduct}
          onClose={() => setVtoProduct(null)}
          productName={vtoProduct.name}
          productImage={vtoProduct.image}
        />
      )}
    </>
  );
}
