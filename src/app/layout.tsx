import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import { MainLayout } from "@/components/layout/MainLayout";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Providers } from "@/components/Providers";
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
            <MainLayout>{children}</MainLayout>
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
