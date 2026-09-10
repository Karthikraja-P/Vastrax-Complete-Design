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
  title: "Vastra | AI Fashion E-commerce",
  description: "Premium AI-powered fashion e-commerce platform",
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
