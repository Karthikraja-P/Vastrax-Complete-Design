import type { Metadata } from "next";
import LegalPage from "@/components/layout/LegalPage";

export const metadata: Metadata = { title: "Shipping Policy", description: "Delivery areas, timelines and charges for VastraX orders.", alternates: { canonical: "/storefront/shipping-policy" }, robots: { index: true, follow: true } };

export default function ShippingPolicyPage() {
  return (
    <LegalPage
      title="Shipping Policy"
      sections={[
        { title: "Where we deliver", body: ["We deliver across India to serviceable pincodes. Shipping charges follow the same rule nationwide; the courier delivery estimate is confirmed at checkout."] },
        { title: "Processing and delivery time", body: ["Orders are packed within 1 to 2 business days. Delivery usually takes 3 to 7 business days after dispatch, depending on your location. Remote areas may take longer."] },
        { title: "Charges", body: ["A flat shipping charge of ₹80 applies across India. Shipping is free when your order subtotal is above ₹1,499. The final amount is shown at checkout before you pay."] },
        { title: "Tracking", body: ["Once shipped, you receive the courier name and tracking number by SMS or email, and can follow the order from your account."] },
        { title: "Delivery attempts", body: ["Couriers make up to three delivery attempts. If the order cannot be delivered, it returns to us and we will contact you to reship or refund, less any return shipping costs where the delay was caused by an incorrect address or an unreachable number."] },
      ]}
    />
  );
}
