import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { getPublicSiteOrigin } from "@/lib/public-site-url";
import { THEME_COLOR_DARK, THEME_COLOR_LIGHT } from "@/lib/theme-color";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const origin = getPublicSiteOrigin();
  // The installed PWA's OS status bar/splash are painted by Android from THIS static field,
  // fetched out-of-band by the OS rather than by the live page — no client-side script can reach
  // it (see the `Accept-CH` comment in next.config.mjs). The `Sec-CH-Prefers-Color-Scheme`
  // Client Hint is the only lever available to vary it, and it tracks the phone's OS-level
  // light/dark setting specifically — not an in-app manual theme override, which this request
  // has no way to know about since it isn't tied to any browser session/localStorage.
  const hintHeaders = await headers();
  const isDark = hintHeaders.get("sec-ch-prefers-color-scheme") === "dark";
  const themeColor = isDark ? THEME_COLOR_DARK : THEME_COLOR_LIGHT;
  return {
    id: `${origin}/`,
    name: "LogBase",
    short_name: "LogBase",
    description:
      "Structure tasks and capture durable activity across your organization—export the trail when stakeholders need proof.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: themeColor,
    theme_color: themeColor,
    icons: [
      {
        src: `${origin}/icons/logbase-app-192.png`,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `${origin}/icons/logbase-app-512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `${origin}/icons/logbase-app-maskable-512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
