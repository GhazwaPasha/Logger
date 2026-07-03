import type { Metadata, Viewport } from "next";
import { DM_Sans, JetBrains_Mono, Outfit } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/app/ServiceWorkerRegister";
import { BootProvider } from "@/components/app/BootProvider";
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
      { url: "/icons/logbase-app-512-win.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: [
      { url: "/icons/logbase-app-180.png", sizes: "180x180", type: "image/png" },
      { url: "/icons/logbase-app-152.png", sizes: "152x152", type: "image/png" },
      { url: "/icons/logbase-app-167.png", sizes: "167x167", type: "image/png" },
    ],
  },
  other: {
    "msapplication-TileImage": `${siteOrigin}/icons/logbase-app-512-win.png`,
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
      <head>
        {/* Apply stored theme before first paint to avoid a flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme-pref');if(t==='light'||t==='dark'||t==='system')document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`,
          }}
        />
      </head>
      <body className={`${dmSans.variable} ${jetbrains.variable} ${outfit.variable} antialiased`}>
        <ServiceWorkerRegister />
        <BootProvider>{children}</BootProvider>
      </body>
    </html>
  );
}
