"use client";

import React from "react";
import { ChevronRight, Home, Shield, Sparkles, Shirt, FileText } from "lucide-react";
import Link from "next/link";

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-background pt-24 pb-20 font-sans transition-colors">
      <div className="max-w-4xl mx-auto px-4 md:px-8">
        
        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-muted-foreground mb-8">
          <Link href="/storefront/home" className="hover:text-[#D4AF37] transition-colors flex items-center">
            <Home className="w-4 h-4" />
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-slate-800 dark:text-foreground font-medium">Terms of Service</span>
        </div>

        <div className="bg-white dark:bg-card p-8 md:p-12 rounded-2xl shadow-sm border border-slate-100 dark:border-border">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-8 h-8 text-accent" />
            <h1 className="text-3xl md:text-4xl font-bold text-[#0A192F] dark:text-foreground tracking-tight">Terms of Service</h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-muted-foreground mb-10">Last Updated: September 15, 2026</p>

          <div className="space-y-8 text-slate-700 dark:text-muted-foreground leading-relaxed text-sm md:text-base">
            
            <section className="space-y-3">
              <h2 className="text-xl font-bold text-[#0A192F] dark:text-foreground flex items-center gap-2">
                1. Agreement to Terms
              </h2>
              <p>
                By accessing or using the VastraX website, mobile interface, or associated services, you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any part of these terms, you may not access or use our platform.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-[#0A192F] dark:text-foreground flex items-center gap-2">
                2. Account Security & OTP Verification
              </h2>
              <p>
                To access personalized features, place orders, or save favorites, users must authenticate via email/phone OTP verification or account credentials. You are responsible for maintaining the confidentiality of your authentication details and for all activities conducted under your account.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-[#0A192F] dark:text-foreground flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-accent inline" />
                3. AI Stylist & AI Fitting Room (Virtual Try-On)
              </h2>
              <p>
                VastraX provides interactive AI features, including the <strong>VASTRAX AI Stylist</strong> assistant, 3D Garment visualization, and <strong>Virtual Try-On / AI Fitting Room</strong> technology.
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Visual Simulation Disclaimer:</strong> Virtual Try-On previews and 3D renderings are visual representations generated for convenience and guidance only. Actual garment fit, drape, color depth, and texture may vary. Customers are encouraged to refer to product <strong>Size Charts</strong> before purchasing.</li>
                <li><strong>AI Recommendations:</strong> Styling advice provided by the AI Stylist is automated and based on garment parameters and user prompts; it does not constitute binding contract guarantees.</li>
                <li><strong>User Image Uploads:</strong> Photos uploaded for Virtual Try-On are processed securely for rendering fitting previews and are handled in compliance with privacy regulations.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-[#0A192F] dark:text-foreground flex items-center gap-2">
                4. Purchases, Pricing & Promotional Offers
              </h2>
              <p>
                We accept major credit cards, debit cards, net banking, and digital wallets via secure payment gateways (including Razorpay). Prices are listed in specified currencies and are subject to change. Promotional discount codes (e.g., VASTRAX10, VIP20) are subject to terms of use and validity periods.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-[#0A192F] dark:text-foreground flex items-center gap-2">
                5. Returns, Exchanges & Customer Reviews
              </h2>
              <p>
                Orders may be returned or exchanged within our designated return window, provided items are unworn and retain original tags. Verified purchasers may submit product ratings and reviews, which must reflect honest customer experiences without profane or defamatory content.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-[#0A192F] dark:text-foreground flex items-center gap-2">
                6. Intellectual Property
              </h2>
              <p>
                All content, trademarks, logos, garment designs, 3D assets, and software code on VastraX are the exclusive property of VastraX. Unauthorized copying, decompilation, or commercial redistribution is strictly prohibited.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-[#0A192F] dark:text-foreground flex items-center gap-2">
                7. Limitation of Liability
              </h2>
              <p>
                In no event shall VastraX or its suppliers be liable for any indirect, consequential, or incidental damages arising out of the use or inability to use the platform services.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-[#0A192F] dark:text-foreground flex items-center gap-2">
                8. Contact Information
              </h2>
              <p>
                If you have any questions or legal inquiries regarding these Terms of Service, please contact our legal team at <strong className="text-accent">legal@vastrax.com</strong>.
              </p>
            </section>

          </div>
        </div>

      </div>
    </div>
  );
}
