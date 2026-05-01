/**
 * Canonical **browser** origin for absolute URLs in manifest icons and `metadataBase`.
 * Edge/Windows shortcut integration often breaks with relative icon paths when `NEXT_PUBLIC_APP_URL`
 * was unset at build time or differs from the opened origin.
 */
export function getPublicSiteOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.VERCEL_URL)
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  return "http://localhost:3000";
}
