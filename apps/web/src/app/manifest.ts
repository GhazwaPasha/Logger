import type { MetadataRoute } from "next";
import { getPublicSiteOrigin } from "@/lib/public-site-url";
import { THEME_COLOR_LIGHT } from "@/lib/theme-color";

export default function manifest(): MetadataRoute.Manifest {
  const origin = getPublicSiteOrigin();
  return {
    id: `${origin}/`,
    name: "LogBase",
    short_name: "LogBase",
    description:
      "Structure tasks and capture durable activity across your organization—export the trail when stakeholders need proof.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    // Manifest colors can't vary by color scheme (only used for the splash screen before the
    // page's own theme-color meta tags take over) — pair them with the light header so the splash
    // matches background_color below rather than the arbitrary gray it used before.
    background_color: "#fafafa",
    theme_color: THEME_COLOR_LIGHT,
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
