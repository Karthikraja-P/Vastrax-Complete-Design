"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mail, Lock, Eye, EyeOff, CheckSquare, Square } from "lucide-react";

export function AuthModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setShowPassword(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Simulate authentication
    setTimeout(() => {
      setIsLoading(false);
      onClose();
    }, 1500);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-black/60 z-50 backdrop-blur-[2px]"
            onClick={onClose}
          />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row pointer-events-auto h-auto md:h-[650px] relative"
            >
              {/* Close Button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 z-10 p-2 bg-black/20 hover:bg-black/40 text-white rounded-full transition-colors backdrop-blur-sm"
              >
                <X className="w-5 h-5" />
              </button>

              {/* LEFT SIDE — AUTHENTICATION FORM */}
              <div className="w-full md:w-[55%] p-8 md:p-12 flex flex-col justify-center bg-[#FAFAFA] text-[#0A192F] relative overflow-y-auto">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={isSignUp ? "signup" : "signin"}
                    initial={{ opacity: 0, x: isSignUp ? 20 : -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: isSignUp ? -20 : 20 }}
                    transition={{ duration: 0.3 }}
                    className="w-full max-w-sm mx-auto"
                  >
                    <div className="mb-8">
                      <h2 className="text-3xl font-light tracking-tight text-[#0A192F] mb-2">
                        {isSignUp ? "Create an account" : "Welcome back"}
                      </h2>
                      <p className="text-slate-500 text-sm">
                        {isSignUp
                          ? "Join us and enjoy a faster checkout experience."
                          : "Sign in to your account to continue shopping."}
                      </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                      {isSignUp && (
                        <div className="flex gap-4">
                          <div className="w-1/2">
                            <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
                              First Name *
                            </label>
                            <input
                              type="text"
                              placeholder="John"
                              required
                              className="w-full bg-slate-100/80 border border-slate-200 rounded-lg px-4 py-3 text-sm focus:bg-white focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] outline-none transition-all placeholder:text-slate-400"
                            />
                          </div>
                          <div className="w-1/2">
                            <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
                              Last Name *
                            </label>
                            <input
                              type="text"
                              placeholder="Smith"
                              required
                              className="w-full bg-slate-100/80 border border-slate-200 rounded-lg px-4 py-3 text-sm focus:bg-white focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] outline-none transition-all placeholder:text-slate-400"
                            />
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
                          Email Address *
                        </label>
                        <div className="relative">
                          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="email"
                            placeholder="you@example.com"
                            required
                            className="w-full bg-slate-100/80 border border-slate-200 rounded-lg pl-10 pr-4 py-3 text-sm focus:bg-white focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] outline-none transition-all placeholder:text-slate-400"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
                          Password *
                        </label>
                        <div className="relative">
                          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type={showPassword ? "text" : "password"}
                            placeholder={isSignUp ? "At least 8 characters" : "Your password"}
                            required
                            className="w-full bg-slate-100/80 border border-slate-200 rounded-lg pl-10 pr-10 py-3 text-sm focus:bg-white focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] outline-none transition-all placeholder:text-slate-400"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 pb-4">
                        {isSignUp ? (
                          <button
                            type="button"
                            onClick={() => setAgreeTerms(!agreeTerms)}
                            className="flex items-center gap-2 text-sm text-slate-600 hover:text-[#0A192F] transition-colors"
                          >
                            {agreeTerms ? (
                              <CheckSquare className="w-4 h-4 text-[#D4AF37]" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400" />
                            )}
                            <span>I agree to the Terms of Service and Privacy Policy</span>
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => setRememberMe(!rememberMe)}
                              className="flex items-center gap-2 text-sm text-slate-600 hover:text-[#0A192F] transition-colors"
                            >
                              {rememberMe ? (
                                <CheckSquare className="w-4 h-4 text-[#D4AF37]" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-400" />
                              )}
                              <span>Remember me</span>
                            </button>
                            <a href="#" className="text-sm font-medium text-slate-600 hover:text-[#D4AF37] transition-colors">
                              Forgot your password?
                            </a>
                          </>
                        )}
                      </div>

                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-3.5 bg-[#D4AF37] hover:bg-[#c5a030] text-white rounded-lg font-medium text-sm transition-all hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-70 disabled:hover:shadow-none disabled:hover:translate-y-0 relative overflow-hidden"
                      >
                        {isLoading ? (
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
                        ) : (
                          isSignUp ? "Create Account" : "Sign In"
                        )}
                      </button>
                    </form>

                    <div className="mt-8 text-center">
                      <p className="text-sm text-slate-500">
                        {isSignUp ? "Already have an account? " : "Don't have an account? "}
                        <button
                          onClick={toggleMode}
                          className="font-semibold text-[#0A192F] hover:text-[#D4AF37] transition-colors underline decoration-[#D4AF37]/30 underline-offset-4 hover:decoration-[#D4AF37]"
                        >
                          {isSignUp ? "Sign in" : "Create one"}
                        </button>
                      </p>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* RIGHT SIDE — FASHION BRANDING PANEL */}
              <div className="hidden md:block w-[45%] relative bg-black overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=1200&auto=format&fit=crop"
                  alt="Luxury Fashion"
                  className="absolute inset-0 w-full h-full object-cover opacity-80"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                
                <div className="absolute inset-x-0 bottom-0 p-10 text-white">
                  <h3 className="text-4xl font-light tracking-wide mb-3 leading-tight">
                    Style that<br />lasts.
                  </h3>
                  <p className="text-white/70 text-sm max-w-xs font-light leading-relaxed">
                    Sign in to track orders, save your wishlist, and check out faster with our premium digital experience.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
