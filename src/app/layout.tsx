import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import { MainLayout } from "@/components/layout/MainLayout";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Providers } from "@/components/Providers";
import { BackendStatusProvider } from "@/components/BackendStatusProvider";
import { ToastContainer } from "@/components/ui/Toast";
import Script from "next/script";
import "./globals.css";


const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://vastrax.ai"),
  title: { default: "VastraX | AI Fashion, 3D Views & Virtual Try-On", template: "%s" },
  description: "Shop premium fashion with an AI stylist, 3D garment views and virtual try-on.",
  applicationName: "VastraX",
  openGraph: { type: "website", siteName: "VastraX", title: "VastraX | AI Fashion", description: "Shop premium fashion with an AI stylist, 3D views and virtual try-on.", url: "/" },
  twitter: { card: "summary_large_image", title: "VastraX | AI Fashion", description: "Shop premium fashion with an AI stylist, 3D views and virtual try-on." },
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
              <ToastContainer />
            </BackendStatusProvider>
          </Providers>
        </ThemeProvider>
        <Script id="microsoft-clarity" strategy="afterInteractive">
          {`
            (function(c,l,a,r,i,t,y){
                c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "yey917sdqo");
          `}
        </Script>
      </body>

    </html>
  );
}
