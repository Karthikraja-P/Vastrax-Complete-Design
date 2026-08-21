"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mail, Lock, Eye, EyeOff, CheckSquare, Square, CheckCircle2 } from "lucide-react";
import { signIn } from "next-auth/react";

export function AuthModal({ isOpen, onClose, initialMode = "signin", onSuccess }: { isOpen: boolean; onClose: () => void; initialMode?: "signin" | "signup"; onSuccess?: (name: string) => void }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loginMethod, setLoginMethod] = useState<"email" | "mobile">("email");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState(false);
  
  // Controlled inputs state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [forgotInput, setForgotInput] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [otp, setOtp] = useState("");
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isGoogleSuccess, setIsGoogleSuccess] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsSignUp(initialMode === "signup");
      setIsForgotPassword(false);
      setIsVerifying(false);
      setForgotPasswordSuccess(false);
    }
  }, [isOpen, initialMode]);

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setShowPassword(false);
    setIsForgotPassword(false);
    setForgotPasswordSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSignUp && !agreeTerms) {
      alert("Please agree to the Terms of Service to continue.");
      return;
    }

    if (isForgotPassword) {
      setIsLoading(true);
      setTimeout(() => {
        setIsLoading(false);
        setForgotPasswordSuccess(true);
      }, 1200);
      return;
    }

    setIsLoading(true);

    try {
      const cleanEmail = (email || "").trim().toLowerCase();
      const authBaseUrls = [
        "http://localhost:8090/api/v1/auth",
        "http://localhost:8088/api/v1/auth",
        "http://localhost:8000/api/v1/auth"
      ];

      if (isSignUp) {
        // Register Real User
        const fullName = `${firstName} ${lastName}`.trim() || firstName || cleanEmail.split("@")[0] || "Customer";
        const regPayload = {
          full_name: fullName,
          email: cleanEmail,
          phone_number: mobileNumber ? `+91${mobileNumber}` : undefined,
          password: password
        };

        let regSuccess = false;
        let lastErrorMsg = "Failed to create account. Please check your details.";

        for (const base of authBaseUrls) {
          try {
            const res = await fetch(`${base}/register`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(regPayload)
            });

            const data = await res.json().catch(() => ({}));
            if (res.ok && data.access_token) {
              if (typeof window !== "undefined") {
                localStorage.setItem("vastrax_token", data.access_token);
              }
              await signIn("credentials", {
                redirect: false,
                id: String(data.user?.id || `usr_${Date.now()}`),
                name: data.user?.full_name || fullName,
                email: cleanEmail,
                password: "AUTHENTICATED",
                accessToken: data.access_token
              });
              regSuccess = true;
              break;
            } else if (data.detail) {
              lastErrorMsg = data.detail;
            }
          } catch {}
        }

        if (!regSuccess) {
          setIsLoading(false);
          alert(lastErrorMsg);
          return;
        }

        setIsLoading(false);
        setIsSuccess(true);
        setTimeout(() => {
          setIsSuccess(false);
          onSuccess?.(fullName);
          onClose();
        }, 1200);
        return;
      }

      // Real User Sign In
      let loginSuccess = false;
      let lastLoginError = "Invalid email or password";
      let loggedUser: any = null;

      for (const base of authBaseUrls) {
        try {
          const res = await fetch(`${base}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: cleanEmail, password })
          });

          const data = await res.json().catch(() => ({}));
          if (res.ok && data.access_token) {
            loggedUser = data.user;
            if (typeof window !== "undefined") {
              localStorage.setItem("vastrax_token", data.access_token);
            }
            await signIn("credentials", {
              redirect: false,
              id: String(data.user?.id || `usr_${Date.now()}`),
              name: data.user?.full_name || cleanEmail.split("@")[0],
              email: cleanEmail,
              password: "AUTHENTICATED",
              accessToken: data.access_token
            });
            loginSuccess = true;
            break;
          } else if (data.detail) {
            lastLoginError = data.detail;
          }
        } catch {}
      }

      if (!loginSuccess) {
        setIsLoading(false);
        alert(lastLoginError);
        return;
      }

      setIsLoading(false);
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onSuccess?.(loggedUser?.full_name || cleanEmail.split("@")[0]);
        onClose();
      }, 1200);

    } catch (err) {
      console.error(err);
      setIsLoading(false);
      alert("Sign in failed. Please check credentials.");
    }
  };

  const handleGoogleSignIn = () => {
    setIsGoogleLoading(true);
    signIn("google", { callbackUrl: "/storefront/home" });
  };

  const handleMobileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "");
    if (val.length <= 10) {
      setMobileNumber(val);
    }
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
              className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row pointer-events-auto h-auto md:min-h-[650px] md:max-h-[90vh] relative"
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
                  {isSuccess ? (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.3 }}
                      className="w-full max-w-sm mx-auto text-center py-12"
                    >
                      <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                      </div>
                      <h2 className="text-3xl font-light tracking-tight text-[#0A192F] mb-3">
                        Success!
                      </h2>
                      <p className="text-slate-500 text-[17px]">
                        Welcome back, {firstName || "Aishwarya"}. You have successfully signed in.
                      </p>
                    </motion.div>
                  ) : (
                    <motion.div
                      key={isSignUp ? "signup" : "signin"}
                      initial={{ opacity: 0, x: isSignUp ? 20 : -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: isSignUp ? -20 : 20 }}
                      transition={{ duration: 0.3 }}
                      className="w-full max-w-sm mx-auto"
                    >
                    <div className="mb-8">
                      <h2 className="text-2xl md:text-3xl font-medium text-[#0A192F] mb-2 leading-tight py-1">
                        {isForgotPassword 
                          ? "Reset Password" 
                          : (isSignUp ? "Create an account" : "Welcome back")}
                      </h2>
                      <p className="text-slate-500 text-[17px]">
                        {isForgotPassword
                          ? (forgotPasswordSuccess 
                            ? "We've sent a password reset link to your account."
                            : "Enter your details to receive a password reset link.")
                          : (isSignUp
                              ? "Unlock exclusive perks, track your orders in real-time, and enjoy a seamless checkout experience."
                              : "Sign in to your account to continue shopping.")}
                      </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                      {isForgotPassword ? (
                        forgotPasswordSuccess ? (
                          <button
                            type="button"
                            onClick={() => {
                              setIsForgotPassword(false);
                              setForgotPasswordSuccess(false);
                            }}
                            className="w-full py-3.5 bg-[#D4AF37] hover:bg-[#c5a030] text-white rounded-lg font-medium text-[17px] transition-all"
                          >
                            Back to Sign In
                          </button>
                        ) : (
                          <>
                            <div>
                              <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
                                Email or Mobile Number *
                              </label>
                              <input
                                type="text"
                                placeholder="you@example.com or 9999999999"
                                required
                                value={forgotInput}
                                onChange={(e) => setForgotInput(e.target.value)}
                                className="w-full bg-slate-100/80 border border-slate-200 rounded-lg px-4 py-3 text-[17px] focus:bg-white focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] outline-none transition-all placeholder:text-slate-400"
                              />
                            </div>
                            <button
                              type="submit"
                              disabled={isLoading}
                              className="w-full py-3.5 bg-[#D4AF37] hover:bg-[#c5a030] text-white rounded-lg font-medium text-[17px] transition-all relative overflow-hidden"
                            >
                              {isLoading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
                              ) : (
                                "Send Reset Link"
                              )}
                            </button>
                            <div className="mt-4 text-center">
                              <button
                                type="button"
                                onClick={() => setIsForgotPassword(false)}
                                className="text-[17px] font-semibold text-slate-500 hover:text-[#0A192F] transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </>
                        )
                      ) : (
                        <>
                          {!isSignUp && (
                            <div className="mb-4">
                              <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wider">
                                Login With
                              </label>
                              <div className="flex items-center gap-6">
                                <label className="flex items-center gap-2 text-[17px] text-slate-700 cursor-pointer">
                                  <input
                                    type="radio"
                                    name="loginMethod"
                                    checked={loginMethod === "email"}
                                    onChange={() => setLoginMethod("email")}
                                    className="accent-[#D4AF37]"
                                  />
                                  Email Address
                                </label>
                                <label className="flex items-center gap-2 text-[17px] text-slate-700 cursor-pointer">
                                  <input
                                    type="radio"
                                    name="loginMethod"
                                    checked={loginMethod === "mobile"}
                                    onChange={() => setLoginMethod("mobile")}
                                    className="accent-[#D4AF37]"
                                  />
                                  Mobile Number
                                </label>
                              </div>
                            </div>
                          )}

                          {isSignUp ? (
                            <>
                              <div className="flex gap-4">
                                <div className="w-1/2">
                                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
                                    First Name *
                                  </label>
                                  <input
                                    type="text"
                                    placeholder="John"
                                    required
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value.replace(/[^a-zA-Z\s-]/g, ''))}
                                    className="w-full bg-slate-100/80 border border-slate-200 rounded-lg px-4 py-3 text-[17px] focus:bg-white focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] outline-none transition-all placeholder:text-slate-400"
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
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value.replace(/[^a-zA-Z\s-]/g, ''))}
                                    className="w-full bg-slate-100/80 border border-slate-200 rounded-lg px-4 py-3 text-[17px] focus:bg-white focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] outline-none transition-all placeholder:text-slate-400"
                                  />
                                </div>
                              </div>
                              
                              <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
                                  Mobile Number *
                                </label>
                                <div className="relative flex">
                                  <span className="inline-flex items-center px-4 bg-slate-100/80 border border-r-0 border-slate-200 rounded-l-lg text-slate-500 text-[17px]">
                                    +91
                                  </span>
                                  <input
                                    type="text"
                                    placeholder="9999999999"
                                    required
                                    value={mobileNumber}
                                    onChange={handleMobileChange}
                                    className="w-full bg-slate-100/80 border border-slate-200 rounded-r-lg px-4 py-3 text-[17px] focus:bg-white focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] outline-none transition-all placeholder:text-slate-400"
                                  />
                                </div>
                              </div>
                              
                              <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
                                  Email Address (Optional)
                                </label>
                                <div className="relative">
                                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                  <input
                                    type="email"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-slate-100/80 border border-slate-200 rounded-lg pl-10 pr-4 py-3 text-[17px] focus:bg-white focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] outline-none transition-all placeholder:text-slate-400"
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
                                    placeholder="At least 8 characters"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-slate-100/80 border border-slate-200 rounded-lg pl-10 pr-10 py-3 text-[17px] focus:bg-white focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] outline-none transition-all placeholder:text-slate-400"
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
                            </>
                          ) : (
                            // Sign In Mode
                            <>
                              {loginMethod === "email" ? (
                                <>
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
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full bg-slate-100/80 border border-slate-200 rounded-lg pl-10 pr-4 py-3 text-[17px] focus:bg-white focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] outline-none transition-all placeholder:text-slate-400"
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
                                        placeholder="Your password"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-slate-100/80 border border-slate-200 rounded-lg pl-10 pr-10 py-3 text-[17px] focus:bg-white focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] outline-none transition-all placeholder:text-slate-400"
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
                                </>
                              ) : (
                                <>
                                  <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
                                      Mobile Number *
                                    </label>
                                    <div className="relative flex">
                                      <span className="inline-flex items-center px-4 bg-slate-100/80 border border-r-0 border-slate-200 rounded-l-lg text-slate-500 text-[17px]">
                                        +91
                                      </span>
                                      <input
                                        type="text"
                                        placeholder="9999999999"
                                        required
                                        value={mobileNumber}
                                        onChange={handleMobileChange}
                                        className="w-full bg-slate-100/80 border border-slate-200 rounded-r-lg px-4 py-3 text-[17px] focus:bg-white focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] outline-none transition-all placeholder:text-slate-400"
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
                                        placeholder="Your password"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-slate-100/80 border border-slate-200 rounded-lg pl-10 pr-10 py-3 text-[17px] focus:bg-white focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] outline-none transition-all placeholder:text-slate-400"
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
                                </>
                              )}
                            </>
                          )}


                          <div className="flex items-center justify-between pt-2 pb-4">
                            {isSignUp ? (
                              <button
                                type="button"
                                onClick={() => setAgreeTerms(!agreeTerms)}
                                className="flex items-center gap-2 text-[17px] text-slate-600 hover:text-[#0A192F] transition-colors"
                              >
                                {agreeTerms ? (
                                  <CheckSquare className="w-4 h-4 text-[#D4AF37]" />
                                ) : (
                                  <Square className="w-4 h-4 text-slate-400" />
                                )}
                                <span>
                                  I agree to the <a href="/storefront/terms" target="_blank" className="underline text-[#D4AF37] hover:text-[#B39030]" onClick={(e) => e.stopPropagation()}>Terms of Service</a>
                                </span>
                              </button>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setRememberMe(!rememberMe)}
                                  className="flex items-center gap-2 text-[17px] text-slate-600 hover:text-[#0A192F] transition-colors"
                                >
                                  {rememberMe ? (
                                    <CheckSquare className="w-4 h-4 text-[#D4AF37]" />
                                  ) : (
                                    <Square className="w-4 h-4 text-slate-400" />
                                  )}
                                  <span>Remember me</span>
                                </button>
                                {loginMethod === "email" && (
                                  <button
                                    type="button"
                                    onClick={() => setIsForgotPassword(true)}
                                    className="text-[17px] font-medium text-slate-600 hover:text-[#D4AF37] transition-colors"
                                  >
                                    Forgot password?
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </>
                      )}

                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-3.5 bg-[#D4AF37] hover:bg-[#c5a030] text-white rounded-lg font-medium text-[17px] transition-all hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-70 disabled:hover:shadow-none disabled:hover:translate-y-0 relative overflow-hidden"
                      >
                        {isLoading ? (
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
                        ) : (
                          isSignUp ? "Create Account" : "Sign In"
                        )}
                      </button>

                      {!isForgotPassword && (
                        <>
                          <div className="relative my-6">
                            <div className="absolute inset-0 flex items-center">
                              <div className="w-full border-t border-slate-200"></div>
                            </div>
                            <div className="relative flex justify-center text-[17px]">
                              <span className="px-2 bg-[#FAFAFA] text-slate-500">or</span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={handleGoogleSignIn}
                            disabled={isLoading || isGoogleLoading || isGoogleSuccess}
                            className={`w-full py-3.5 bg-white border border-slate-200 text-[#0A192F] rounded-lg font-medium text-[17px] transition-all flex items-center justify-center gap-3 disabled:opacity-70 disabled:hover:shadow-none ${isGoogleSuccess ? 'border-green-500 bg-green-50 text-green-700' : 'hover:bg-slate-50 hover:shadow-md'}`}
                          >
                            {isGoogleSuccess ? (
                              <div className="flex items-center gap-2">
                                <CheckSquare className="w-5 h-5 text-green-600" />
                                <span>Success!</span>
                              </div>
                            ) : isGoogleLoading ? (
                              <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-400 rounded-full animate-spin" />
                            ) : (
                              <>
                                <svg className="w-5 h-5" viewBox="0 0 24 24">
                                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                </svg>
                                Continue with Google
                              </>
                            )}
                          </button>
                        </>
                      )}
                    </form>

                    {!isForgotPassword && (
                      <div className="mt-8 text-center">
                        <p className="text-[17px] text-slate-500">
                          {isSignUp ? "Already have an account? " : "Don't have an account? "}
                          <button
                            onClick={toggleMode}
                            className="font-semibold text-[#0A192F] hover:text-[#D4AF37] transition-colors underline decoration-[#D4AF37]/30 underline-offset-4 hover:decoration-[#D4AF37]"
                          >
                            {isSignUp ? "Sign in" : "Create one"}
                          </button>
                        </p>
                      </div>
                    )}
                  </motion.div>
                  )}
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
                  <p className="text-white/70 text-[17px] max-w-xs font-light leading-relaxed">
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
