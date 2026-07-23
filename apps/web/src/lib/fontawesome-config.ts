import { config } from "@fortawesome/fontawesome-svg-core";

/**
 * FontAwesome auto-injects a `<style>` tag with `.svg-inline--fa { width: 1.25em; height: 1em }`.
 * That rule sits outside Tailwind's `@layer utilities`, so per CSS cascade rules it beats every
 * `size-*` utility class regardless of source order — icons silently render at `1em` (relative to
 * whatever font-size their container happens to have) instead of the size we set. Disable it so our
 * own classNames are the only thing controlling icon size.
 */
config.autoAddCss = false;
