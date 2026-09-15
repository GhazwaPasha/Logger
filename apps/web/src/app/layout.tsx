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
  // Deliberately NOT declaring `themeColor` here: Next's metadata system re-renders/reconciles
  // this tag from this static value on every client-side navigation (it doesn't know about our
  // runtime updates), which was stomping the resolved theme's color right back to whatever
  // constant this said — the status bar would revert to one fixed color no matter what the user
  // picked. The inline script below creates and fully owns a plain, Next-invisible meta tag
  // instead, and `useThemePreference` keeps mutating that same element afterwards.
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
        {/* Apply stored theme before first paint to avoid a flash, and create the one and only
            theme-color meta tag ourselves (see the comment on `viewport` above for why Next
            must not render its own). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme-pref');var theme=(t==='light'||t==='dark'||t==='system')?t:'system';document.documentElement.setAttribute('data-theme',theme);var isDark=theme==='dark'||(theme==='system'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);var m=document.querySelector('meta[name="theme-color"]');if(!m){m=document.createElement('meta');m.setAttribute('name','theme-color');document.head.appendChild(m);}m.setAttribute('content',isDark?'${THEME_COLOR_DARK}':'${THEME_COLOR_LIGHT}');}catch(e){}})();`,
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
