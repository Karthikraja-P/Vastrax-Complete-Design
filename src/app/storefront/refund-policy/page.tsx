import type { Metadata } from "next";
import LegalPage from "@/components/layout/LegalPage";

export const metadata: Metadata = { title: "Returns & Refunds | VastraX", description: "Return, exchange, cancellation and refund terms for VastraX orders." };

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
        { title: "Damaged or incorrect items", body: ["If your item arrives damaged or is not what you ordered, email us within 48 hours of delivery with photos of the item and packaging. We will arrange a free replacement or full refund."] },
        { title: "How refunds work", body: ["Approved refunds go back to the original payment method within 5 to 7 business days after we receive and inspect the item. Your bank may take additional time to show the credit. Shipping fees are refunded only when the return is due to our error."] },
        { title: "Virtual try-on and 3D previews", body: ["Try-on images and 3D views are visual aids and may differ from the real garment in fit, colour and drape. A difference from a preview alone is not a reason for a refund, but you may still return the item under the terms above."] },
      ]}
    />
  );
}
