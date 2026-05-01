import type { MetadataRoute } from "next";
import { getPublicSiteOrigin } from "@/lib/public-site-url";

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
    background_color: "#fafafa",
    theme_color: "#27272a",
    icons: [
      {
        src: `${origin}/icons/logbase-app-192.png`,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `${origin}/icons/logbase-app-256.png`,
        sizes: "256x256",
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
        src: `${origin}/icons/logbase-app-512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
