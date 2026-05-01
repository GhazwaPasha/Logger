import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/app/ServiceWorkerRegister";
import { getPublicSiteOrigin } from "@/lib/public-site-url";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

const siteOrigin = getPublicSiteOrigin();

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  title: "LogBase",
  description: "Structure tasks and capture durable activity across your organization—export the trail when stakeholders need proof.",
  icons: {
    icon: [
      { url: "/favicon.ico", type: "image/x-icon" },
      { url: "/pwa-192.png", sizes: "192x192", type: "image/png" },
      { url: "/pwa-256.png", sizes: "256x256", type: "image/png" },
      { url: "/pwa-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/pwa-256.png",
  },
  other: {
    "msapplication-TileImage": `${siteOrigin}/pwa-512.png`,
    "msapplication-TileColor": "#fafafa",
  },
  appleWebApp: {
    capable: true,
    title: "LogBase",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#27272a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="system" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrains.variable} antialiased`}>
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
