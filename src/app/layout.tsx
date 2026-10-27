import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { SiteHeader } from "@/components/shell/site-header";
import { BottomNav } from "@/components/shell/bottom-nav";
import { SiteFooter } from "@/components/shell/site-footer";
import { OfflineBanner } from "@/components/shell/offline-banner";
import { ServiceWorkerRegister } from "@/components/shell/sw-register";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "REDLINK — Blood availability & donor coordination", template: "%s · REDLINK" },
  description:
    "Freshness-aware blood availability search and emergency donor coordination connecting requesters, donors, verified hospitals and blood banks.",
};

export const viewport: Viewport = {
  themeColor: "#f5f0e7",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-charcoal focus:px-3 focus:py-2 focus:text-ivory"
        >
          Skip to content
        </a>
        <ToastProvider>
          <OfflineBanner />
          <SiteHeader />
          <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 md:px-6 md:pb-12">
            {children}
          </main>
          <SiteFooter />
          <BottomNav />
        </ToastProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
