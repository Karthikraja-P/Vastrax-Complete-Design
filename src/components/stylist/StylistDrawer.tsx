"use client";
import Image from "next/image";

import { useState, useRef, useEffect, useMemo, useSyncExternalStore } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Sparkles, X, Send, Bot,
  Shirt, RefreshCcw, Loader2, CheckCircle2, Heart, ShoppingBag, Eye,
  ChevronDown, ChevronRight, ImagePlus
} from "lucide-react";
import { chatApi, fetchApi, ordersApi, type ChatResponse } from "@/lib/api";
import { useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useFavorites } from "@/hooks/useFavorites";
import { addToCart as addCartItem, getCart } from "@/lib/cart";
import { showToast } from "@/lib/toast";

type SuggestedProduct = NonNullable<ChatResponse["suggested_products"]>[number];
type ExecutedTool = NonNullable<ChatResponse["executed_tools"]>[number];

// Shown on any Stylist API failure (MiniMax unconfigured/unavailable); never a fabricated recommendation.
const STYLIST_OUTAGE_MESSAGE = "Vastra is off hunting for better outfits. Please try again in a bit.";
const PERSONALIZE_TIPS_PROMPT = "I’d like styling tips tailored to me. Please ask one optional question at a time. I may share my height or height range, preferred fit or garment length, colors I enjoy wearing, and the occasion. I can skip anything. Do not ask about my skin colour or infer personal traits from my photo.";

const SESSION_ID_KEY = "vastrax_stylist_session_id";
const LAST_ACTIVE_KEY = "vastrax_stylist_last_active";
const SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_STYLIST_IMAGE_BYTES = 3 * 1024 * 1024;
const MAX_STYLIST_UPLOAD_BYTES = 12 * 1024 * 1024;

async function prepareStylistImage(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Choose a JPG, PNG, or WebP photo.');
  }
  if (file.size > MAX_STYLIST_UPLOAD_BYTES) {
    throw new Error('Choose an image smaller than 12 MB.');
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new window.Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('This image could not be opened.'));
      element.src = objectUrl;
    });
    let scale = Math.min(1, 1280 / Math.max(image.naturalWidth, image.naturalHeight));
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Your browser could not prepare this image.');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.82));
      if (!blob) throw new Error('Your browser could not prepare this image.');
      if (blob.size <= MAX_STYLIST_IMAGE_BYTES) {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Image processing failed.'));
          reader.onerror = () => reject(new Error('Image processing failed.'));
          reader.readAsDataURL(blob);
        });
        return dataUrl;
      }
      scale *= 0.75;
    }
    throw new Error('This photo is too detailed to process. Try a smaller image.');
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

const currentTimeMs = () => Date.now();

/** Returns the active stylist session id, rotating it after 24h of inactivity, and marks it active now. */
function touchStylistSession(): string {
  let sid = localStorage.getItem(SESSION_ID_KEY);
  const lastActive = localStorage.getItem(LAST_ACTIVE_KEY);
  if (!sid || !lastActive || currentTimeMs() - parseInt(lastActive, 10) > SESSION_TIMEOUT_MS) {
    sid = `ses_${crypto.randomUUID()}`;
    localStorage.setItem(SESSION_ID_KEY, sid);
  }
  localStorage.setItem(LAST_ACTIVE_KEY, currentTimeMs().toString());
  return sid;
}

function hasPlacedOrderLocally(): boolean {
  return localStorage.getItem("vastrax_has_placed_order") === "true" || !!localStorage.getItem("vastrax_last_order_id");
}

const subscribeToStorage = (onChange: () => void) => {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
};

interface Message {
  id: string;
  sender: "user" | "stylist";
  text: string;
  timestamp: string;
  chips?: string[];
  suggestedProducts?: SuggestedProduct[];
  executedTools?: ExecutedTool[];
  isEscalated?: boolean;
  imagePreview?: string;
}

interface ActivitySuggestions {
  greeting: string;
  chips: string[];
  prompts: string[];
}

function getSuggestionsForActivity(
  pathname: string,
  hasOrders: boolean,
  hasCartItems: boolean,
  favoritesCount: number
): ActivitySuggestions {
  const isProductPage = pathname === "/storefront/product" || (pathname?.startsWith("/storefront/product") && !pathname?.includes("/tryon"));
  const isTryonPage = pathname?.includes("/tryon");
  const isCartPage = pathname?.includes("/cart") || pathname?.includes("/checkout");

  let greeting = "Hi there! I'm your VASTRAX AI Stylist. How can I assist your styling journey today?";
  const chips: string[] = [];
  const prompts: string[] = [];

  // 1. Order Activity: ONLY show order tracking if user has actually placed an order!
  if (hasOrders) {
    chips.push("Track my order");
    prompts.push("Where is my order?");
  }

  // 2. Page / Browsing Activity
  if (isProductPage) {
    greeting = "Admiring this piece? I can suggest matching pairings, help with sizing, or prepare it for your AI Fitting Room.";
    chips.push("How to style this piece", "What size fits me?", "Try this on");
    prompts.push("What accessories or bottoms pair with this?", "Is this true to size?");
  } else if (isTryonPage) {
    greeting = "Welcome to the AI Fitting Room! Would you like tips for the best try-on fit or alternative pieces to style?";
    chips.push("Virtual Try-On Tips", "Find matching pieces", "Size & fit guide");
    prompts.push("Recommend another outfit to try on", "How do I get the best fitting result?");
  } else if (isCartPage) {
    greeting = "Reviewing your shopping bag? I can verify active promotions or suggest finishing touches.";
    chips.push("Current offers", "Pair with accessories");
    prompts.push("What active discount codes are available?", "Recommend matching pieces for my bag");
  } else {
    // Collections or Home page: Multi-Occasion Carousel
    chips.push(
      "Wedding / Festive",
      "Office Wear",
      "Casual / Everyday",
      "Trending Looks",
      "Party / Night Out",
      "Resort / Vacation"
    );
    prompts.push(
      "Curate an office capsule look",
      "Wedding guest outfit ideas",
      "Trending pieces this week",
      "Relaxed weekend casual styling"
    );
  }

  // 3. Cart Activity
  if (hasCartItems && !isCartPage) {
    if (!chips.includes("Complete my look")) {
      chips.unshift("Complete my look");
    }
    prompts.push("Suggest accessories to complete my cart items");
  }

  // 4. Favorites Activity
  if (favoritesCount > 0) {
    prompts.push("How should I style my saved favorites?");
  }

  return {
    greeting,
    chips: Array.from(new Set(chips)).slice(0, 8),
    prompts: Array.from(new Set(prompts)).slice(0, 6)
  };
}

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
  isOpen?: boolean;
  onClose?: () => void;
}

export function StylistDrawer({ isOpen: externalIsOpen, onClose: externalOnClose }: StylistDrawerProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = externalIsOpen !== undefined ? (externalIsOpen || internalOpen) : internalOpen;

  const handleClose = () => {
    setInternalOpen(false);
    externalOnClose?.();
  };

  useEffect(() => {
    const handleOpen = () => setInternalOpen(true);
    window.addEventListener("open-stylist", handleOpen);
    return () => window.removeEventListener("open-stylist", handleOpen);
  }, []);

  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const { isFavorite, toggleFavorite, favorites } = useFavorites();

  const [apiHasOrders, setApiHasOrders] = useState(false);
  const [apiFavoritesCount, setApiFavoritesCount] = useState(0);
  const [showInspiration, setShowInspiration] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [addedToCart, setAddedToCart] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleAddToCart = (product: SuggestedProduct) => {
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

  // Activity-based context computation
  const localHasOrders = useSyncExternalStore(subscribeToStorage, hasPlacedOrderLocally, () => false);
  const signedIn = !!session?.user;

  useEffect(() => {
    if (localHasOrders || !signedIn) return;
    ordersApi.myOrders().then(ords => {
      if (ords && ords.length > 0) {
        setApiHasOrders(true);
      }
    }).catch(() => {});
  }, [isOpen, localHasOrders, signedIn]);

  const hasOrders = localHasOrders || (signedIn && apiHasOrders);

  useEffect(() => {
    if (!isOpen || !signedIn) return;
    let active = true;
    fetchApi<Array<{ id: string }>>("/users/me/wishlist")
      .then((items) => { if (active) setApiFavoritesCount(Array.isArray(items) ? items.length : 0); })
      .catch(() => { if (active) setApiFavoritesCount(0); });
    return () => { active = false; };
  }, [isOpen, signedIn]);

  // Active prompts follow activity or route changes
  const activePrompts = useMemo(() => {
    void isOpen; // recompute (cart contents may have changed) whenever the drawer is toggled
    const cartHasItems = getCart().length > 0;
    const favsCount = Math.max(favorites?.length || 0, signedIn ? apiFavoritesCount : 0);
    return getSuggestionsForActivity(pathname, hasOrders, cartHasItems, favsCount).prompts;
  }, [isOpen, pathname, hasOrders, favorites, signedIn, apiFavoritesCount]);

  // Initialize or load session & history
  useEffect(() => {
    const sid = touchStylistSession();

    async function loadHistory() {
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
    if (isTyping) return;
    const imageData = textToSend ? null : attachedImage;
    const query = (textToSend ?? input).trim() || (imageData ? "Please find VastraX products that look similar to this photo." : "");
    if (!query) return;

    const userMessageId = `u-${currentTimeMs()}`;
    const userMsg: Message = {
      id: userMessageId,
      sender: "user",
      text: query,
      timestamp: "Just now",
      imagePreview: imageData ?? undefined,
    };

    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setAttachedImage(null);
    setImageError(null);
    setIsTyping(true);
    const sessionId = touchStylistSession();

    try {
      const historyPayload = messages.map(m => ({
        role: m.sender === "user" ? "user" : "assistant",
        content: m.text
      }));

      const contextUrl = typeof window !== 'undefined' ? `${pathname}${window.location.search}` : '';
      const userId = (session?.user as { id?: string } | undefined)?.id || session?.user?.email || undefined;
      
      // Share only useful cart details; image URLs and stored cart metadata are not
      // needed for a styling conversation.
      const cartContext = getCart().map(({ id, name, size, color, quantity }) => ({
        id,
        name,
        size,
        color,
        quantity,
      }));
      const res = await chatApi.sendMessage(query, sessionId, historyPayload, {}, contextUrl, cartContext, userId, favorites, imageData ?? undefined);
      const { cleanText, chips } = parseTagsFromReply(res.message);

      const stylistMsg: Message = {
        id: `s-${currentTimeMs()}`,
        sender: "stylist",
        text: cleanText,
        timestamp: "Just now",
        chips,
        suggestedProducts: res.suggested_products && res.suggested_products.length > 0 
          ? res.suggested_products 
          : undefined,
        executedTools: res.executed_tools,
        isEscalated: res.is_escalated,
      };
      setMessages(prev => [...prev, stylistMsg]);
    } catch {
      const fallbackMsg: Message = {
        id: `s-${currentTimeMs()}`,
        sender: "stylist",
        text: STYLIST_OUTAGE_MESSAGE,
        timestamp: "Just now"
      };
      setMessages(prev => [...prev, fallbackMsg]);
    } finally {
      if (imageData) {
        // Remove the customer's photo from the in-memory chat as soon as processing ends.
        setMessages(prev => prev.map(message => message.id === userMessageId ? { ...message, imagePreview: undefined } : message));
      }
      setIsTyping(false);
    }
  };

  const handleImageSelected = async (file?: File) => {
    setImageError(null);
    if (!file) return;
    try {
      setAttachedImage(await prepareStylistImage(file));
    } catch (error) {
      setAttachedImage(null);
      setImageError(error instanceof Error ? error.message : "This image could not be prepared.");
    }
  };

  const handleClearChat = async () => {
    if (confirm("Reset and clear your styling conversation history?")) {
      await chatApi.clearHistory(localStorage.getItem(SESSION_ID_KEY) ?? undefined);
      const newSid = `ses_${crypto.randomUUID()}`;
      localStorage.setItem(SESSION_ID_KEY, newSid);
      localStorage.setItem(LAST_ACTIVE_KEY, currentTimeMs().toString());
      setMessages([]);
      setShowInspiration(false);
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
              onClick={handleClose}
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
                    onClick={handleClose}
                    className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Message Flow */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 flex flex-col">
                {/* Warm Luxury Welcome Canvas (Customer First) */}
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center text-center py-10 px-3 my-auto animate-in fade-in duration-300">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-accent/20 to-[#e2733d]/20 border border-accent/30 flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(224,122,63,0.2)]">
                      <Sparkles className="w-7 h-7 text-accent" />
                    </div>
                    <h4 className="text-base md:text-lg font-bold text-foreground tracking-tight mb-2">
                      Welcome in — I’m Vastra
                    </h4>
                    <p className="text-sm text-muted-foreground max-w-sm leading-relaxed mb-5">
                      Tell me what you’re shopping for, or point me to a piece you like. I can help you put a look together, check sizes and availability, or find an order. What’s on your mind?
                    </p>

                    <div className="w-full max-w-sm grid grid-cols-1 gap-1.5">
                      {activePrompts.slice(0, 3).map((prompt, i) => (
                        <button
                          key={i}
                          onClick={() => handleSend(prompt)}
                          className="text-left px-3.5 py-2.5 rounded-xl bg-surface border border-border/80 hover:border-accent/40 text-sm text-foreground hover:text-accent transition-all cursor-pointer shadow-sm hover:scale-[1.01] flex items-center justify-between group"
                        >
                          <span>{prompt}</span>
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      aria-label="Get optional style tips tailored to my preferences"
                      onClick={() => handleSend(PERSONALIZE_TIPS_PROMPT)}
                      className="w-full max-w-sm mt-2 py-2.5 px-4 rounded-xl border border-border bg-surface/80 hover:bg-surface text-sm text-foreground flex items-center justify-between transition-colors cursor-pointer shadow-sm"
                    >
                      <span className="flex items-center gap-2 font-medium text-accent">
                        <Sparkles className="w-4 h-4" /> Personalize my tips
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>

                    <button
                      type="button"
                      aria-label="Ask for general style tips without product recommendations"
                      onClick={() => handleSend("Give me general style tips only; no product recommendations, please.")}
                      className="w-full max-w-sm mt-2 py-2.5 px-4 rounded-xl border border-accent/30 bg-accent/5 hover:bg-accent/10 text-sm text-foreground flex items-center justify-between transition-colors cursor-pointer shadow-sm"
                    >
                      <span className="flex items-center gap-2 font-medium text-accent">
                        <Sparkles className="w-4 h-4" /> General style tips
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>

                    {/* Keep the first welcome simple while leaving more conversation starters available. */}
                    {activePrompts.length > 3 && <div className="w-full max-w-sm mt-2">
                      <button
                        type="button"
                        onClick={() => setShowInspiration(prev => !prev)}
                        className="w-full py-2.5 px-4 rounded-xl border border-border bg-surface/80 hover:bg-surface text-xs text-foreground/90 flex items-center justify-between transition-colors cursor-pointer shadow-sm"
                      >
                        <span className="flex items-center gap-2 font-medium text-accent">
                          <Sparkles className="w-3.5 h-3.5" /> More ideas
                        </span>
                        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${showInspiration ? "rotate-180" : ""}`} />
                      </button>

                      {showInspiration && (
                        <div className="grid grid-cols-1 gap-1.5 pt-2 pb-1 animate-in fade-in slide-in-from-top-1 duration-200">
                          {activePrompts.slice(3).map((prompt, i) => (
                            <button
                              key={i}
                              onClick={() => handleSend(prompt)}
                              className="text-left px-3.5 py-2 rounded-xl bg-surface border border-border/80 hover:border-accent/40 text-xs text-foreground hover:text-accent transition-all cursor-pointer shadow-sm hover:scale-[1.01] flex items-center justify-between group"
                            >
                              <span>{prompt}</span>
                              <ChevronRight className="w-3 h-3 text-muted-foreground group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>}
                  </div>
                )}

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
                        {msg.imagePreview && (
                          <Image src={msg.imagePreview} alt="Photo shared temporarily for product matching" width={192} height={192} unoptimized className="mb-2 max-h-48 max-w-48 rounded-xl object-contain" />
                        )}
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

                        {/* Human Concierge Escalation Banner */}
                        {msg.isEscalated && (
                          <div className="mt-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2.5 shadow-sm animate-in fade-in">
                            <Bot className="w-4 h-4 text-amber-400 shrink-0" />
                            <div>
                              <p className="font-semibold text-[11px] text-amber-200">Concierge Ticket Created</p>
                              <p className="text-[10px] text-amber-300/80 mt-0.5">A senior human atelier specialist has been assigned to this thread.</p>
                            </div>
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
                                      router.push(`/storefront/product?id=${p.id || 1}`);
                                      handleClose();
                                    }}
                                    title="View Details"
                                  >
                                    <Image width={1200} height={900} unoptimized src={p.image} alt={p.name} className="w-full h-full object-contain bg-[#f8f7f4] p-1" />
                                  </div>
                                  <h5 
                                    className="text-xs font-semibold text-foreground truncate cursor-pointer hover:text-accent transition-colors"
                                    onClick={() => {
                                      router.push(`/storefront/product?id=${p.id || 1}`);
                                      handleClose();
                                    }}
                                  >
                                    {p.name}
                                  </h5>
                                  <p className="text-[11px] text-accent font-bold mt-0.5">{String(p.price).startsWith('₹') ? p.price : `₹${String(p.price).replace(/^\$/, '')}`}</p>
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
                                        handleClose();
                                      }}
                                      className="flex-1 py-1.5 rounded bg-accent/15 hover:bg-accent text-accent hover:text-accent-foreground transition-colors flex items-center justify-center cursor-pointer"
                                      title="Try On"
                                    >
                                      <Shirt className="w-3.5 h-3.5" />
                                    </button>
                                    <button 
                                      onClick={() => {
                                        router.push(`/storefront/product?id=${p.id || 1}`);
                                        handleClose();
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

              {/* Input Bar */}
              <div className="p-4 border-t border-border bg-surface">
                {attachedImage && (
                  <div className="mb-2 flex items-center gap-2 rounded-xl border border-border bg-background p-2">
                    <Image src={attachedImage} alt="Photo ready for temporary product matching" width={48} height={56} unoptimized className="h-14 w-12 rounded-lg object-cover" />
                    <p className="min-w-0 flex-1 text-xs text-muted-foreground">Photo ready. It is processed for this request and is not saved to your chat or account.</p>
                    <button type="button" aria-label="Remove attached photo" onClick={() => setAttachedImage(null)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent/10 hover:text-accent">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
                {imageError && <p role="status" className="mb-2 px-2 text-xs text-red-500">{imageError}</p>}
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSend();
                  }}
                  className="vx-stylist-composer flex items-center gap-2 bg-background border border-border rounded-full px-3 py-2 focus-within:border-accent transition-colors"
                >
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(event) => {
                      void handleImageSelected(event.currentTarget.files?.[0]);
                      event.currentTarget.value = "";
                    }}
                  />
                  <button
                    type="button"
                    aria-label="Attach a photo to find similar products"
                    title="Attach a photo to find similar products"
                    disabled={isTyping}
                    onClick={() => imageInputRef.current?.click()}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent/10 hover:text-accent disabled:opacity-40"
                  >
                    <ImagePlus className="h-4 w-4" />
                  </button>
                  <input 
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask your stylist anything about fit, color, or occasions..."
                    className="vx-stylist-input min-w-0 flex-1 appearance-none rounded-none border-0 bg-transparent p-0 text-sm text-foreground shadow-none outline-none ring-0 placeholder:text-muted-foreground focus:border-0 focus:outline-none focus:ring-0"
                  />
                  <button 
                    type="submit"
                    disabled={(!input.trim() && !attachedImage) || isTyping}
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
            setInternalOpen(true);
            const ev = new CustomEvent("open-stylist");
            window.dispatchEvent(ev);
          }}
          className="vx-stylist-launch fixed bottom-6 right-6 z-40 min-h-11 px-4 py-3 rounded-full bg-gradient-to-r from-accent to-[#e2733d] text-accent-foreground font-medium text-xs uppercase tracking-wider flex items-center gap-2 shadow-[0_0_25px_rgba(224,122,63,0.5)] hover:scale-105 transition-all cursor-pointer"
        >
          <Sparkles className="w-4 h-4" />
          <span>AI Stylist</span>
        </motion.button>
      )}

      {/* Try-on Modal removed, using dedicated page routing */}
    </>
  );
}
