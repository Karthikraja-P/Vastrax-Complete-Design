import type { Metadata } from "next";
import LegalPage from "@/components/layout/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy | VastraX", description: "How VastraX collects, uses and protects your personal data." };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      sections={[
        { title: "Who we are", body: ["VastraX (\"we\", \"us\") operates vastrax.ai, an online fashion store with AI styling, 3D garment viewing and virtual try-on. We process personal data in line with the Digital Personal Data Protection Act, 2023 and other applicable Indian law."] },
        { title: "Data we collect", body: [[
          "Account data: name, email address and phone number, verified through one-time passwords.",
          "Order data: delivery addresses, items purchased, order and payment status. Card, UPI and bank details are entered on Razorpay's secure page and are never stored by us.",
          "Virtual try-on photos you upload, and the generated try-on images.",
          "Messages you send to the AI Stylist.",
          "Technical data such as IP address, browser type and security logs, used to keep the service safe.",
        ]] },
        { title: "How we use it", body: [[
          "To create your account, process and deliver orders, and provide support.",
          "To generate virtual try-on previews and styling suggestions you request.",
          "To prevent fraud and abuse, including rate limiting and security monitoring.",
          "To send order updates and verification codes. We send marketing only with your consent.",
        ]] },
        { title: "Try-on photos", body: ["Photos are used only to render the try-on you request. They are processed on our own infrastructure, are not sold or used to train third-party models, and are deleted on request. Please upload only photos of yourself or people who have agreed."] },
        { title: "Who we share data with", body: ["We share only what is needed with service providers acting for us: Razorpay (payments), Shiprocket and courier partners (delivery), SMS and email providers (verification and order messages), Google (optional sign-in), and our AI provider for the Stylist chat (message text only). We disclose data to authorities where the law requires it. We do not sell personal data."] },
        { title: "Retention", body: ["We keep account and order records for as long as your account is active and as required for tax and legal purposes. Verification codes expire within minutes and are purged regularly."] },
        { title: "Your rights", body: ["You may access, correct or delete your data, withdraw consent, and nominate someone to act for you. Delete your account from Settings, or email us and we will respond within 30 days."] },
        { title: "Security", body: ["Data is encrypted in transit (HTTPS). Passwords are hashed, access is role-restricted, and sign-in attempts are rate limited. No system is perfectly secure; we will notify you and the authorities of a breach as the law requires."] },
        { title: "Cookies", body: ["We use essential cookies for sign-in and session security. We do not use advertising cookies."] },
        { title: "Children", body: ["The service is not intended for anyone under 18 without a parent or guardian's involvement, and we do not knowingly collect children's data."] },
        { title: "Changes", body: ["We will update this page when our practices change and revise the date above."] },
      ]}
    />
  );
}
