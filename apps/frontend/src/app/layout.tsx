import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/lib/providers";
import { Navbar } from "@/components/shared/navbar";
import { Footer } from "@/components/shared/footer";
import { AuthInitializer } from "@/components/shared/auth-initializer";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://frameos.dev'),
  title: {
    default: "FrameOS - The AI Agent Marketplace",
    template: "%s | FrameOS"
  },
  description: "Build, share, and monetize AI agents on the FrameOS marketplace. Execute agents on-demand with transparent pricing and instant deployment.",
  keywords: ["AI agents", "marketplace", "automation", "API", "developer platform", "agent runtime"],
  authors: [{ name: "FrameOS Team" }],
  creator: "FrameOS",
  publisher: "FrameOS",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://frameos.dev",
    title: "FrameOS - The AI Agent Marketplace",
    description: "Build, share, and monetize AI agents on the FrameOS marketplace",
    siteName: "FrameOS",
  },
  twitter: {
    card: "summary_large_image",
    title: "FrameOS - The AI Agent Marketplace",
    description: "Build, share, and monetize AI agents",
    creator: "@frameos",
  },
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <QueryProvider>
          <AuthInitializer />
          <div className="flex min-h-screen flex-col">
            <Navbar />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
          <Toaster />
        </QueryProvider>
      </body>
    </html>
  );
}
