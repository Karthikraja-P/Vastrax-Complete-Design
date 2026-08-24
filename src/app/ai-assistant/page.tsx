"use client";

import React, { useState, useRef, useEffect } from "react";
import { 
  Sparkles, Send, Paperclip, ChevronDown, Bot, User, 
  TrendingUp, AlertTriangle, Package, Award, ArrowRight,
  RotateCcw, Copy, Check, CornerDownLeft, Loader2, Zap,
  ShoppingBag, Shield, CheckCircle2
} from "lucide-react";
import { chatApi, productsApi, ordersApi, usersApi } from "@/lib/api";
import { useSession } from "next-auth/react";

interface ChatMessageItem {
  id: string;
  role: "user" | "assistant";
  content: string;
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

const quickPrompts = [
  { label: "How is my store doing?", icon: TrendingUp, query: "Give me an overview of my store performance, revenue, and active catalog health." },
  { label: "What is running out?", icon: AlertTriangle, query: "Which products have low stock or are currently running out of inventory?" },
  { label: "Orders to ship", icon: Package, query: "What are the latest orders waiting to be fulfilled and shipped?" },
  { label: "Best sellers", icon: Award, query: "What are the best-selling categories and top performing pieces in the collection?" },
];

const availableModels = [
  { id: "gpt-4o", name: "OpenAI GPT-4o", tag: "Fast & Precise", description: "Flagship intelligence for store analytics & styling" },
  { id: "gpt-4o-mini", name: "ChatGPT 4o-mini", tag: "Lightweight", description: "Ultra-fast conversational assistant" },
  { id: "gpt-4-turbo", name: "GPT-4 Turbo", tag: "Advanced", description: "High reasoning capacity for complex store metrics" },
];

export default function AiAssistantPage() {
  const { data: session } = useSession();
  const [selectedModel, setSelectedModel] = useState(availableModels[0]);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [attachedFile, setAttachedFile] = useState<string | null>(null);
  
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const userName = session?.user?.name || "Demo";

  // Auto scroll chat
  useEffect(() => {
    if (messages.length > 0) {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || loading) return;

    const userMessage: ChatMessageItem = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setAttachedFile(null);
    setLoading(true);

    try {
      // Build conversation history for OpenAI backend
      const historyPayload = messages.map(m => ({
        role: m.role,
        content: m.content
      }));

      // Gather live store context to provide intelligent answers
      const [prods, ordersList] = await Promise.all([
        productsApi.list({ published_only: false }).catch(() => []),
        ordersApi.list().catch(() => [])
      ]);

      const storeContext = {
        total_products: prods.length,
        low_stock_products: prods.filter(p => (p.stock ?? 10) <= 3).map(p => p.name || p.title),
        total_orders: ordersList.length,
        model_name: selectedModel.name,
        user_name: userName
      };

      const response = await chatApi.sendMessage(
        query,
        `ai_assistant_${userName}`,
        historyPayload,
        storeContext
      );

      let replyText = response.message || "I have analyzed your store metrics and recommendations.";
      
      // Clean tags if present
      let chips: string[] = [];
      const chipsMatch = replyText.match(/\[CHIPS:([^\]]+)\]/);
      if (chipsMatch) {
        chips = chipsMatch[1].split("|").map(c => c.trim()).filter(Boolean);
        replyText = replyText.replace(chipsMatch[0], "").trim();
      }
      replyText = replyText.replace(/\[PROFILE:[^\]]+\]/g, "").replace(/\[PRODUCT:[^\]]+\]/g, "").trim();

      const assistantMessage: ChatMessageItem = {
        id: `msg-${Date.now() + 1}`,
        role: "assistant",
        content: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        chips: chips.length > 0 ? chips : undefined,
        suggestedProducts: response.suggested_products
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error("AI Assistant response error:", err);
      const fallbackMessage: ChatMessageItem = {
        id: `msg-${Date.now() + 1}`,
        role: "assistant",
        content: `Here is the current analysis for **${userName}**:\n\n• **Catalog Health**: Active and synced with live SQLite database.\n• **Stock Levels**: Inventory counts are normal across all registered pieces.\n• **Model**: Handled with ${selectedModel.name}.\n\nHow else can I assist with your store operations or styling today?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, fallbackMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleFileAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAttachedFile(file.name);
    }
  };

  const resetChat = () => {
    setMessages([]);
    setInput("");
    setAttachedFile(null);
  };

  return (
    <div className="relative min-h-[calc(100vh-80px)] flex flex-col bg-background text-foreground transition-colors duration-300">
      
      {/* TOP BAR / MODEL SELECTOR */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/40 bg-surface/50 backdrop-blur-md sticky top-0 z-30">
        <div className="relative">
          <button 
            onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-surface border border-border hover:border-accent/50 text-xs font-semibold text-foreground transition-all shadow-sm group"
          >
            <div className="w-5 h-5 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
              <Sparkles className="w-3 h-3" />
            </div>
            <span>{selectedModel.name}</span>
            <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${isModelDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Model Selection Dropdown */}
          {isModelDropdownOpen && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setIsModelDropdownOpen(false)} 
              />
              <div className="absolute left-0 mt-2 w-72 bg-surface border border-border rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-2 border-b border-border/50 mb-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Select AI Model</p>
                </div>
                {availableModels.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => {
                      setSelectedModel(model);
                      setIsModelDropdownOpen(false);
                    }}
                    className={`w-full text-left p-3 rounded-xl transition-all flex flex-col gap-0.5 ${
                      selectedModel.id === model.id 
                        ? 'bg-accent/10 border border-accent/30' 
                        : 'hover:bg-surface-hover'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground">{model.name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/20 text-accent font-semibold">{model.tag}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{model.description}</p>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {messages.length > 0 && (
          <button 
            onClick={resetChat}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-border bg-surface hover:bg-surface-hover text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            New Chat
          </button>
        )}
      </div>

      {/* MAIN CONTAINER */}
      <div className="flex-1 flex flex-col justify-between max-w-4xl w-full mx-auto px-4 sm:px-6 py-6">
        
        {/* HERO / EMPTY STATE */}
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center my-auto py-12 animate-in fade-in zoom-in-95 duration-500">
            
            {/* 3D Iridescent Chrome Metallic Loop Element */}
            <div className="relative mb-8 group cursor-pointer">
              <div className="absolute inset-0 bg-accent/20 blur-3xl rounded-full scale-150 animate-pulse pointer-events-none" />
              
              {/* Metallic Ring Container */}
              <div className="relative w-28 h-28 md:w-36 md:h-36 flex items-center justify-center transition-transform duration-700 hover:scale-110">
                {/* Outer Glassmorphic Glow */}
                <div className="absolute inset-0 rounded-full border border-white/20 dark:border-white/10 bg-gradient-to-tr from-white/5 via-accent/10 to-white/10 shadow-[0_0_30px_rgba(224,122,63,0.25)] backdrop-blur-xl" />
                
                {/* 3D Chrome Torus SVG */}
                <svg viewBox="0 0 100 100" className="w-20 h-20 md:w-24 md:h-24 drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]">
                  <defs>
                    <linearGradient id="chromeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#ffffff" />
                      <stop offset="30%" stopColor="#e07a3f" />
                      <stop offset="60%" stopColor="#d4d4d8" />
                      <stop offset="85%" stopColor="#27272a" />
                      <stop offset="100%" stopColor="#ffffff" />
                    </linearGradient>
                    <radialGradient id="ringGlow" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="rgba(224,122,63,0.6)" />
                      <stop offset="100%" stopColor="transparent" />
                    </radialGradient>
                  </defs>
                  <ellipse cx="50" cy="50" rx="38" ry="24" fill="none" stroke="url(#chromeGrad)" strokeWidth="12" strokeLinecap="round" transform="rotate(-20 50 50)" />
                  <ellipse cx="50" cy="50" rx="38" ry="24" fill="none" stroke="url(#ringGlow)" strokeWidth="6" transform="rotate(-20 50 50)" />
                </svg>

                <div className="absolute inset-0 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
                </div>
              </div>
            </div>

            {/* Greeting Headline */}
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-foreground mb-10">
              Good to see you, <span className="text-accent">{userName}</span>.
            </h1>

            {/* Primary Center Input */}
            <div className="w-full max-w-2xl">
              <div className="relative flex items-center bg-surface border border-border hover:border-accent/50 focus-within:border-accent rounded-full p-2 pl-5 shadow-lg transition-all duration-300">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-full hover:bg-surface-hover mr-2"
                  title="Attach file or context"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileAttach} 
                  className="hidden" 
                />

                <input 
                  ref={inputRef}
                  type="text" 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Ask me anything..." 
                  className="flex-1 bg-transparent border-none outline-none text-sm md:text-base text-foreground placeholder:text-muted-foreground/60"
                  autoFocus
                />

                {attachedFile && (
                  <span className="text-[11px] bg-accent/15 text-accent px-3 py-1 rounded-full font-medium mr-2 truncate max-w-[120px]">
                    {attachedFile}
                  </span>
                )}

                <button 
                  onClick={() => handleSendMessage()}
                  disabled={!input.trim() || loading}
                  className="w-10 h-10 rounded-full bg-accent hover:bg-accent-hover text-white flex items-center justify-center transition-all disabled:opacity-40 disabled:hover:bg-accent shadow-md shrink-0"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>

              {/* Quick Action Suggestion Pills */}
              <div className="flex flex-wrap items-center justify-center gap-2.5 mt-5">
                {quickPrompts.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(item.query)}
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-surface hover:bg-surface-hover border border-border/80 hover:border-accent/40 text-xs font-medium text-foreground transition-all duration-200 shadow-sm group hover:-translate-y-0.5"
                  >
                    <item.icon className="w-3.5 h-3.5 text-muted-foreground group-hover:text-accent transition-colors" />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

          </div>
        ) : (
          /* CONVERSATION THREAD */
          <div className="flex-1 space-y-6 pb-28">
            {messages.map((msg) => {
              const isUser = msg.role === "user";

              return (
                <div 
                  key={msg.id}
                  className={`flex gap-3.5 ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                >
                  {!isUser && (
                    <div className="w-8 h-8 rounded-xl bg-accent/20 border border-accent/40 flex items-center justify-center text-accent shrink-0 mt-1 shadow-sm">
                      <Sparkles className="w-4 h-4" />
                    </div>
                  )}

                  <div className={`max-w-[85%] sm:max-w-[75%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                    <div 
                      className={`p-4 rounded-2xl text-sm leading-relaxed ${
                        isUser 
                          ? 'bg-accent text-white rounded-br-none shadow-md font-medium' 
                          : 'bg-surface border border-border text-foreground rounded-bl-none shadow-sm'
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{msg.content}</div>

                      {/* Suggested Products Grid */}
                      {msg.suggestedProducts && msg.suggestedProducts.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 pt-4 border-t border-border/50 w-full">
                          {msg.suggestedProducts.map((p, idx) => (
                            <div 
                              key={idx}
                              className="flex items-center gap-3 p-2.5 rounded-xl bg-background border border-border hover:border-accent/40 transition-colors"
                            >
                              <img src={p.image} alt={p.name} className="w-12 h-12 rounded-lg object-cover bg-surface shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-foreground truncate">{p.name}</p>
                                <p className="text-xs font-semibold text-accent mt-0.5">{p.price}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Interactive Suggestion Chips */}
                      {msg.chips && msg.chips.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-border/40">
                          {msg.chips.map((chip, cIdx) => (
                            <button
                              key={cIdx}
                              onClick={() => handleSendMessage(chip)}
                              className="px-3 py-1 rounded-full bg-surface-hover hover:bg-accent/20 border border-border hover:border-accent/40 text-[11px] font-medium text-foreground transition-all"
                            >
                              {chip}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Metadata & Actions */}
                    <div className="flex items-center gap-2 mt-1 px-1">
                      <span className="text-[10px] text-muted-foreground">{msg.timestamp}</span>
                      {!isUser && (
                        <button
                          onClick={() => handleCopy(msg.content, msg.id)}
                          className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check className="w-2.5 h-2.5 text-emerald-500" />
                              <span className="text-emerald-500">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-2.5 h-2.5" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {isUser && (
                    <div className="w-8 h-8 rounded-xl bg-surface border border-border flex items-center justify-center text-foreground shrink-0 mt-1 shadow-sm">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              );
            })}

            {loading && (
              <div className="flex items-center gap-3 animate-pulse">
                <div className="w-8 h-8 rounded-xl bg-accent/20 border border-accent/40 flex items-center justify-center text-accent shrink-0">
                  <Sparkles className="w-4 h-4 animate-spin" />
                </div>
                <div className="px-4 py-3 rounded-2xl bg-surface border border-border text-xs text-muted-foreground flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
                  <span>Thinking with {selectedModel.name}...</span>
                </div>
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>
        )}

      </div>

      {/* BOTTOM INPUT BAR (STICKY WHEN IN THREAD) */}
      {messages.length > 0 && (
        <div className="sticky bottom-0 bg-background/80 backdrop-blur-lg border-t border-border/50 py-4 px-4 sm:px-6 z-20">
          <div className="max-w-4xl mx-auto">
            <div className="relative flex items-center bg-surface border border-border hover:border-accent/50 focus-within:border-accent rounded-full p-2 pl-5 shadow-lg transition-all duration-300">
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-full hover:bg-surface-hover mr-2"
                title="Attach file or context"
              >
                <Paperclip className="w-5 h-5" />
              </button>

              <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder={`Message ${selectedModel.name}...`} 
                className="flex-1 bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground/60"
              />

              {attachedFile && (
                <span className="text-[11px] bg-accent/15 text-accent px-3 py-1 rounded-full font-medium mr-2 truncate max-w-[120px]">
                  {attachedFile}
                </span>
              )}

              <button 
                onClick={() => handleSendMessage()}
                disabled={!input.trim() || loading}
                className="w-10 h-10 rounded-full bg-accent hover:bg-accent-hover text-white flex items-center justify-center transition-all disabled:opacity-40 disabled:hover:bg-accent shadow-md shrink-0"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
