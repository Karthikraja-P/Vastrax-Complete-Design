"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Sparkles, X, Send, Bot, User, ArrowRight, 
  Shirt, RefreshCcw, Loader2, CheckCircle2, MessageSquare, Heart, ShoppingBag, Eye
} from "lucide-react";
import { chatApi, tryonApi } from "@/lib/api";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useFavorites } from "@/hooks/useFavorites";
import { addToCart as addCartItem } from "@/lib/cart";
import { showToast } from "@/lib/toast";

interface Message {
  id: string;
  sender: "user" | "stylist";
  text: string;
  timestamp: string;
  chips?: string[];
  suggestedProducts?: {
    id?: string;
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
    text: "Hi there! I'm your VASTRAX AI Stylist. How can I help you find the perfect outfit today?",
    timestamp: "Just now",
    chips: ["Wedding / Festive", "Office / Work", "Casual / Everyday", "Current Offers"]
  }
];

const samplePrompts = [
  "What active discounts do you have?",
  "Curate a minimalist evening gala outfit",
  "How to style the Silk Evening Blazer?",
  "Recommend monochrome autumn essentials"
];

function parseTagsFromReply(rawText: string) {
  let cleanText = rawText;
  let chips: string[] = [];

  // Extract [CHIPS:Option1|Option2]
  const chipsMatch = cleanText.match(/\[CHIPS:([^\]]+)\]/);
  if (chipsMatch) {
    chips = chipsMatch[1].split("|").map(c => c.trim()).filter(Boolean);
    cleanText = cleanText.replace(chipsMatch[0], "").trim();
  }

  // Remove [PROFILE:{...}]
  cleanText = cleanText.replace(/\[PROFILE:[^\]]+\]/g, "").trim();

  // Remove [PRODUCT:id] tags from visible message text (products are rendered in the card grid)
  cleanText = cleanText.replace(/\[PRODUCT:[^\]]+\]/g, "").trim();

  return { cleanText, chips };
}

interface StylistDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function StylistDrawer({ isOpen, onClose }: StylistDrawerProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const [addedToCart, setAddedToCart] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const { isFavorite, toggleFavorite } = useFavorites();

  const handleAddToCart = (product: any) => {
    const pId = product.id || product.name;
    setAddedToCart(prev => [...prev, pId]);
    setTimeout(() => {
      setAddedToCart(prev => prev.filter(item => item !== pId));
    }, 2000);

    const priceNum = typeof product.price === 'string' 
      ? parseFloat(product.price.replace(/[^0-9.-]+/g,"")) || 0
      : Number(product.price) || 0;

    addCartItem({
      id: pId,
      name: product.name,
      price: priceNum,
      quantity: 1,
      size: "M",
      color: "Default",
      image: product.image
    });

    showToast({
      title: "Added to Shopping Bag",
      description: `${product.name} (Stylist Pick)`,
      type: "gold",
      image: product.image,
      duration: 3000
    });
  };

  // Initialize or load session & history
  useEffect(() => {
    const SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours
    let sid = localStorage.getItem("vastrax_stylist_session_id");
    let lastActive = localStorage.getItem("vastrax_stylist_last_active");
    
    if (!sid || !lastActive || (Date.now() - parseInt(lastActive, 10)) > SESSION_TIMEOUT_MS) {
      sid = `ses_${Math.random().toString(36).substring(2, 11)}_${Date.now()}`;
      localStorage.setItem("vastrax_stylist_session_id", sid);
      localStorage.setItem("vastrax_stylist_last_active", Date.now().toString());
    } else {
      localStorage.setItem("vastrax_stylist_last_active", Date.now().toString());
    }
    setSessionId(sid);

    async function loadHistory() {
      if (!sid) return;
      const history = await chatApi.getHistory(sid);
      if (history && history.length > 0) {
        const parsed: Message[] = history.map(h => {
          const { cleanText, chips } = parseTagsFromReply(h.text);
          return {
            id: h.id,
            sender: h.sender,
            text: cleanText,
            timestamp: h.timestamp,
            chips,
            suggestedProducts: h.suggestedProducts
          };
        });
        setMessages(parsed);
      }
    }
    loadHistory();
  }, [isOpen]);

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
    localStorage.setItem("vastrax_stylist_last_active", Date.now().toString());

    try {
      const historyPayload = messages.map(m => ({
        role: m.sender === "user" ? "user" : "assistant",
        content: m.text
      }));

      const contextUrl = typeof window !== 'undefined' ? `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}` : '';
      
      const res = await chatApi.sendMessage(query, sessionId, historyPayload, {}, contextUrl, []);
      const { cleanText, chips } = parseTagsFromReply(res.message);

      const stylistMsg: Message = {
        id: `s-${Date.now()}`,
        sender: "stylist",
        text: cleanText,
        timestamp: "Just now",
        chips,
        suggestedProducts: res.suggested_products && res.suggested_products.length > 0 
          ? res.suggested_products 
          : undefined
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

  const handleClearChat = async () => {
    if (confirm("Reset and clear your styling conversation history?")) {
      await chatApi.clearHistory(sessionId);
      const newSid = `ses_${Math.random().toString(36).substring(2, 11)}_${Date.now()}`;
      localStorage.setItem("vastrax_stylist_session_id", newSid);
      setSessionId(newSid);
      setMessages(initialMessages);
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
              className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-background border-l border-border shadow-2xl flex flex-col overflow-hidden text-foreground"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-accent to-[#e2733d] flex items-center justify-center shadow-[0_0_12px_rgba(224,122,63,0.4)]">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm tracking-tight text-foreground flex items-center gap-2">
                      VASTRAX AI Stylist
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    </h3>
                    <p className="text-[11px] text-muted-foreground">GPT-4o mini Haute Couture Concierge</p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button 
                    onClick={handleClearChat}
                    title="Reset chat history"
                    className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <RefreshCcw className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={onClose}
                    className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
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
                          className={`p-4 rounded-2xl text-sm leading-relaxed whitespace-pre-line ${
                            msg.sender === "user"
                              ? "bg-accent text-accent-foreground rounded-tr-none shadow-[0_0_15px_rgba(224,122,63,0.25)]"
                              : "bg-surface border border-border text-foreground rounded-tl-none"
                          }`}
                        >
                          {msg.text}
                        </div>

                        {/* Interactive Suggestion Chips */}
                        {msg.chips && msg.chips.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2.5">
                            {msg.chips.map((chip, idx) => (
                              <button
                                key={idx}
                                onClick={() => handleSend(chip)}
                                className="px-3 py-1 rounded-full bg-accent/15 hover:bg-accent text-accent hover:text-accent-foreground text-xs font-medium border border-accent/30 transition-all cursor-pointer shadow-sm hover:scale-105"
                              >
                                {chip}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Suggested Products attached to message */}
                        {msg.suggestedProducts && msg.suggestedProducts.length > 0 && (
                          <div className="mt-3 space-y-2">
                            <p className="text-[10px] uppercase font-bold tracking-wider text-accent flex items-center gap-1">
                              <Sparkles className="w-3 h-3" /> Recommended Boutique Pieces
                            </p>
                            <div className="grid grid-cols-2 gap-2.5">
                              {msg.suggestedProducts.map((p, idx) => (
                                <div 
                                  key={idx}
                                  className="bg-surface border border-border rounded-xl p-2.5 flex flex-col justify-between hover:border-accent/40 transition-colors group"
                                >
                                  <div 
                                    className="aspect-square rounded-lg overflow-hidden bg-muted mb-2 relative cursor-pointer"
                                    onClick={() => {
                                      router.push(`/storefront/product/${p.id || 1}`);
                                      onClose();
                                    }}
                                    title="View Details"
                                  >
                                    <img src={p.image} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                  </div>
                                  <h5 
                                    className="text-xs font-semibold text-foreground truncate cursor-pointer hover:text-accent transition-colors"
                                    onClick={() => {
                                      router.push(`/storefront/product/${p.id || 1}`);
                                      onClose();
                                    }}
                                  >
                                    {p.name}
                                  </h5>
                                  <p className="text-[11px] text-accent font-bold mt-0.5">{p.price}</p>
                                  <div className="mt-2 flex items-center justify-between gap-1.5">
                                    <button 
                                      onClick={() => toggleFavorite(p.id || p.name)}
                                      className={`flex-1 py-1.5 rounded flex items-center justify-center transition-colors cursor-pointer ${
                                        isFavorite(p.id || p.name) ? "bg-red-500/10 text-red-500" : "bg-surface-hover text-muted-foreground hover:text-foreground"
                                      }`}
                                      title="Favorite"
                                    >
                                      <Heart className={`w-3.5 h-3.5 ${isFavorite(p.id || p.name) ? "fill-red-500" : ""}`} />
                                    </button>
                                    <button 
                                      onClick={() => handleAddToCart(p)}
                                      className="flex-1 py-1.5 rounded bg-surface-hover hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center cursor-pointer"
                                      title="Add to Cart"
                                    >
                                      {addedToCart.includes(p.id || p.name) ? (
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                      ) : (
                                        <ShoppingBag className="w-3.5 h-3.5" />
                                      )}
                                    </button>
                                    <button 
                                      onClick={() => {
                                        router.push(`/storefront/product/${p.id || 1}/tryon`);
                                        onClose();
                                      }}
                                      className="flex-1 py-1.5 rounded bg-accent/15 hover:bg-accent text-accent hover:text-accent-foreground transition-colors flex items-center justify-center cursor-pointer"
                                      title="Try On"
                                    >
                                      <Shirt className="w-3.5 h-3.5" />
                                    </button>
                                    <button 
                                      onClick={() => {
                                        router.push(`/storefront/product/${p.id || 1}`);
                                        onClose();
                                      }}
                                      className="flex-1 py-1.5 rounded bg-surface-hover hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center cursor-pointer"
                                      title="View Details"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
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
              <div className="px-6 py-2 border-t border-border bg-surface overflow-x-auto whitespace-nowrap scrollbar-none flex gap-2">
                {samplePrompts.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(prompt)}
                    className="px-3 py-1 rounded-full bg-muted hover:bg-surface-hover text-[11px] text-muted-foreground transition-colors border border-border shrink-0"
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              {/* Input Bar */}
              <div className="p-4 border-t border-border bg-surface">
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSend();
                  }}
                  className="flex items-center gap-2 bg-background border border-border rounded-full px-4 py-2 focus-within:border-accent transition-colors"
                >
                  <input 
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask your stylist anything about fit, color, or occasions..."
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                  />
                  <button 
                    type="submit"
                    disabled={!input.trim() || isTyping}
                    className="w-8 h-8 rounded-full bg-accent hover:bg-accent/90 disabled:opacity-40 text-accent-foreground flex items-center justify-center transition-all shadow-[0_0_10px_rgba(224,122,63,0.3)] shrink-0"
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
          className="fixed bottom-6 right-6 z-40 px-4 py-3 rounded-full bg-gradient-to-r from-accent to-[#e2733d] text-accent-foreground font-medium text-xs uppercase tracking-wider flex items-center gap-2 shadow-[0_0_25px_rgba(224,122,63,0.5)] hover:scale-105 transition-all"
        >
          <Sparkles className="w-4 h-4" />
          <span>Stylist Concierge</span>
        </motion.button>
      )}

      {/* Try-on Modal removed, using dedicated page routing */}
    </>
  );
}
