import type { Metadata } from "next";
import LegalPage from "@/components/layout/LegalPage";

export const metadata: Metadata = { title: "Returns & Refunds", description: "Return, exchange, cancellation and refund terms for VastraX orders.", alternates: { canonical: "/storefront/refund-policy" }, robots: { index: true, follow: true } };

export default function RefundPolicyPage() {
  return (
    <LegalPage
      title="Returns & Refunds"
      sections={[
        { title: "Cancellations", body: ["You can cancel an order from your account any time before it is shipped. Once shipped, please use the return process below."] },
        { title: "Returns and exchanges", body: [[
          "Request a return within 7 days of delivery.",
          "Items must be unworn, unwashed and have original tags and packaging.",
          "Exchanges are subject to stock availability in the size you need.",
          "Innerwear, customised or altered items and items marked final sale cannot be returned.",
        ]] },
        { title: "Damaged or incorrect items", body: [
          "A continuous, unedited parcel-opening video is required documentation for a damage-related replacement or refund request. Start recording before opening the sealed parcel, show the shipping label, and keep recording through the opening and clear reveal of the item and damage. Please contact us within 48 hours of delivery and send the video to our support email. If you cannot provide a video, contact us promptly; every claim is reviewed in line with applicable consumer-protection requirements.",
          "If the item is incorrect, contact us within 48 hours of delivery with clear photos of the item and packaging. We will review the issue and arrange an appropriate resolution.",
        ] },
        { title: "How refunds work", body: ["Approved refunds go back to the original payment method within 5 to 7 business days after we receive and inspect the item. Your bank may take additional time to show the credit. Shipping fees are refunded only when the return is due to our error."] },
        { title: "Virtual try-on and 3D previews", body: ["Try-on images and 3D views are visual aids and may differ from the real garment in fit, colour and drape. A difference from a preview alone is not a reason for a refund, but you may still return the item under the terms above."] },
      ]}
    />
  );
}
