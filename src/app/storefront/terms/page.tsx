"use client";

import React from "react";
import { ChevronRight, Home } from "lucide-react";
import Link from "next/link";

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] pt-24 pb-20 font-serif">
      <div className="max-w-4xl mx-auto px-4 md:px-8">
        
        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-8">
          <Link href="/storefront/home" className="hover:text-[#D4AF37] transition-colors flex items-center">
            <Home className="w-4 h-4" />
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-slate-800 font-medium">Terms of Service</span>
        </div>

        <div className="bg-white p-8 md:p-12 rounded-2xl shadow-sm border border-slate-100">
          <h1 className="text-4xl font-bold text-[#0A192F] mb-6">Terms of Service</h1>
          <p className="text-sm text-slate-500 mb-10">Last Updated: August 20, 2026</p>

          <div className="space-y-8 text-slate-700 leading-relaxed">
            <section>
              <h2 className="text-2xl font-bold text-[#0A192F] mb-4">1. Agreement to Terms</h2>
              <p>
                By accessing or using our website, you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any part of these terms, you may not access our service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0A192F] mb-4">2. Use License</h2>
              <p>
                Permission is granted to temporarily download one copy of the materials (information or software) on VastraX's website for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:
              </p>
              <ul className="list-disc pl-6 mt-4 space-y-2">
                <li>Modify or copy the materials;</li>
                <li>Use the materials for any commercial purpose, or for any public display (commercial or non-commercial);</li>
                <li>Attempt to decompile or reverse engineer any software contained on VastraX's website;</li>
                <li>Remove any copyright or other proprietary notations from the materials.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0A192F] mb-4">3. Purchases and Payment</h2>
              <p>
                We accept various forms of payment for our products. You agree to provide current, complete, and accurate purchase and account information for all purchases made at our store. You agree to promptly update your account and other information, including your email address and payment method details, so that we can complete your transactions and contact you as needed.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0A192F] mb-4">4. Returns and Refunds</h2>
              <p>
                Please review our Return Policy posted on the Site prior to making any purchases. We reserve the right to refuse or cancel your order at any time for reasons including but not limited to: product or service availability, errors in the description or price of the product or service, or error in your order.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0A192F] mb-4">5. Disclaimer</h2>
              <p>
                The materials on VastraX's website are provided on an 'as is' basis. VastraX makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0A192F] mb-4">6. Contact Information</h2>
              <p>
                If you have any questions about these Terms, please contact us at <strong>legal@vastrax.com</strong>.
              </p>
            </section>
          </div>
        </div>

      </div>
    </div>
  );
}
