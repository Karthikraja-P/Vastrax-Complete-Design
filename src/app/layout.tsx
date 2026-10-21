import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import { MainLayout } from "@/components/layout/MainLayout";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Providers } from "@/components/Providers";
import { BackendStatusProvider } from "@/components/BackendStatusProvider";
import { ToastContainer } from "@/components/ui/Toast";
import CookieConsent from "@/components/layout/CookieConsent";
import "./globals.css";


const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://vastrax.ai"),
  title: { default: "VastraX | Coordinated Sets for Women", template: "%s | VastraX" },
  description: "Shop VastraX women's coordinated two-piece sets, check available sizes, and view product details online.",
  applicationName: "VastraX",
  robots: { index: false, follow: false },
  openGraph: { type: "website", siteName: "VastraX", title: "VastraX | Coordinated Sets for Women", description: "Shop coordinated two-piece sets from VastraX.", url: "/storefront/home", images: ["/opengraph-image"] },
  twitter: { card: "summary_large_image", title: "VastraX | Coordinated Sets for Women", description: "Shop coordinated two-piece sets from VastraX.", images: ["/opengraph-image"] },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${outfit.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans transition-colors duration-300">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <Providers>
            <BackendStatusProvider>
              <MainLayout>{children}</MainLayout>
              <CookieConsent />
              <ToastContainer />
            </BackendStatusProvider>
          </Providers>
        </ThemeProvider>
      </body>

    </html>
  );
}
