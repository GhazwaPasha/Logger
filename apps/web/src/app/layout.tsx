import type { Metadata, Viewport } from "next";
import { DM_Sans, JetBrains_Mono, Outfit } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/app/ServiceWorkerRegister";
import { BootProvider } from "@/components/app/BootProvider";
import { getPublicSiteOrigin } from "@/lib/public-site-url";
import { THEME_COLOR_DARK, THEME_COLOR_LIGHT } from "@/lib/theme-color";
import "@/lib/fontawesome-config";
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
    // Translucent status bar lets the header's own background (which already pads for the
    // safe-area inset via `.safe-top`) show through, so it matches instead of iOS's opaque default.
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_COLOR_LIGHT },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLOR_DARK },
  ],
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="system" suppressHydrationWarning>
      <head>
        {/* Apply stored theme before first paint to avoid a flash. When the user has explicitly
            picked light/dark (not "system"), also pin the status-bar color to match — otherwise
            the prefers-color-scheme theme-color meta tags Next generates from the `viewport`
            export below would follow the OS instead. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme-pref');if(t==='light'||t==='dark'||t==='system')document.documentElement.setAttribute('data-theme',t);if(t==='light'||t==='dark'){var m=document.createElement('meta');m.id='theme-color-override';m.setAttribute('name','theme-color');m.setAttribute('content',t==='dark'?'${THEME_COLOR_DARK}':'${THEME_COLOR_LIGHT}');document.head.appendChild(m);}}catch(e){}})();`,
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
