import type { CSSProperties } from "react";

export type LogBaseMarkVariant = "chrome" | "marketing" | "footer" | "auth";

type LogBaseMarkProps = {
  /**
   * Preset sizes tuned per surface (header density, marketing hero, etc.).
   * Pass `size` to override the variant pixel height/width.
   */
  variant?: LogBaseMarkVariant;
  /** Square slot side length in CSS pixels. */
  size?: number;
  className?: string;
  /** Hide from assistive tech when the wordmark label is already adjacent. */
  decorative?: boolean;
};

const VARIANT_PX: Record<LogBaseMarkVariant, number> = {
  /** Marketing nav and product shot (`h-14`): visually matches `text-sm` wordmark + size-9 controls. The app header passes its own size. */
  chrome: 34,
  /** Marketing nav: pairs with `text-xl` / `text-2xl` without overpowering */
  marketing: 44,
  /** Footer column: quieter than nav; still legible at small type sizes */
  footer: 32,
  /** Auth card: balanced with small caps / headings above the fold */
  auth: 36,
};

/**
 * Pre-scaled copies of each mark (public/Logos/logbase-<theme>-<width>.png) next to the 1270px
 * original. The browser picks the smallest one that covers size × device pixel ratio, so it never
 * has to shrink the full-size file 40×+ on first paint, which Chrome draws blurry until a repaint.
 */
const LOGO_WIDTHS = [64, 128, 256, 512] as const;

function logoSrcSet(theme: "light" | "dark") {
  return [
    ...LOGO_WIDTHS.map((w) => `/Logos/logbase-${theme}-${w}.png ${w}w`),
    `/Logos/logbase-${theme}.png 1270w`,
  ].join(", ");
}

/**
 * Light UI → `logbase-light.png`; dark UI → `logbase-dark.png`.
 * Square slot + `object-fit: contain` (assets are landscape, 1270×850).
 */
export function LogBaseMark({
  variant = "chrome",
  size: sizeOverride,
  className = "",
  decorative,
}: LogBaseMarkProps) {
  const size = sizeOverride ?? VARIANT_PX[variant];
  const dim = Math.round(size * 2);
  const boxStyle = { width: size, height: size } satisfies CSSProperties;
  const sizes = `${size}px`;

  return (
    <span
      className={`relative inline-block shrink-0 align-middle ${className}`}
      style={boxStyle}
      {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": "LogBase" })}
    >
      <img
        src="/Logos/logbase-light-256.png"
        srcSet={logoSrcSet("light")}
        sizes={sizes}
        alt=""
        width={dim}
        height={dim}
        draggable={false}
        className="brand-logo-mark-for-light-theme"
      />
      <img
        src="/Logos/logbase-dark-256.png"
        srcSet={logoSrcSet("dark")}
        sizes={sizes}
        alt=""
        width={dim}
        height={dim}
        draggable={false}
        className="brand-logo-mark-for-dark-theme"
      />
    </span>
  );
}
