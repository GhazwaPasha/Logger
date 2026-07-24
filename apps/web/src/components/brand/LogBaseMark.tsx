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
  /** App shell header (`h-14`): visually matches `text-sm` wordmark + size-9 controls */
  chrome: 34,
  /** Marketing nav: pairs with `text-xl` / `text-2xl` without overpowering */
  marketing: 44,
  /** Footer column: quieter than nav; still legible at small type sizes */
  footer: 32,
  /** Auth card: balanced with small caps / headings above the fold */
  auth: 36,
};

/**
 * Light UI → `logbase-light.png`; dark UI → `logbase-dark.png`.
 * Square slot + `object-fit: contain` (assets are portrait ~824×924).
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

  return (
    <span
      className={`relative inline-block shrink-0 align-middle ${className}`}
      style={boxStyle}
      {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": "LogBase" })}
    >
      <img
        src="/Logos/logbase-light.png"
        alt=""
        width={dim}
        height={dim}
        decoding="async"
        draggable={false}
        className="brand-logo-mark-for-light-theme"
      />
      <img
        src="/Logos/logbase-dark.png"
        alt=""
        width={dim}
        height={dim}
        decoding="async"
        draggable={false}
        className="brand-logo-mark-for-dark-theme"
      />
    </span>
  );
}
