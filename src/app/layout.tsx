import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/lib/supabase/auth-context";
import { OfflineSyncProvider } from "@/lib/offline/offline-sync-provider";
import { ServiceWorkerRegistration } from "@/components/offline/service-worker-registration";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ZarratAI",
  description:
    "AI-powered agricultural decision-support for farmers in Punjab, Pakistan",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <OfflineSyncProvider>
            <ServiceWorkerRegistration />
            {children}
          </OfflineSyncProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
