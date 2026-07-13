import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Site currently unavailable",
  description:
    "This site is temporarily unavailable while maintenance is in progress.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Site unavailable",
  },
};

export const viewport: Viewport = {
  themeColor: "#1f2937",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="default"
        />
        <meta name="apple-mobile-web-app-title" content="DriveNow" />
      </head>
      <body className="bg-bg text-text-primary font-body antialiased">
        {children}
        <PWAInstallPrompt />
      </body>
    </html>
  );
}
