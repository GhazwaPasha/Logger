import type { Metadata, Viewport } from "next";
import { DM_Sans, JetBrains_Mono, Outfit } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/app/ServiceWorkerRegister";
import { getPublicSiteOrigin } from "@/lib/public-site-url";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const siteOrigin = getPublicSiteOrigin();

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  title: "LogBase",
  description: "Structure tasks and capture durable activity across your organization—export the trail when stakeholders need proof.",
  icons: {
    icon: [
      { url: "/favicon.ico", type: "image/x-icon" },
      { url: "/icons/logbase-app-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/logbase-app-256.png", sizes: "256x256", type: "image/png" },
      { url: "/icons/logbase-app-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/icons/logbase-app-256.png",
  },
  other: {
    "msapplication-TileImage": `${siteOrigin}/icons/logbase-app-512.png`,
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
      <body className={`${dmSans.variable} ${jetbrains.variable} ${outfit.variable} antialiased`}>
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
