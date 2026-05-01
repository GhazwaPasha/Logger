# Web UI styling (LogBase / `apps/web`)

How the **Next.js** app implements look-and-feel: **Tailwind v4**, **CSS variables**, utility-ish **component classes** in a single global stylesheet. Pair with [[apps-web]] for routing/auth.

## Stack

- **Tailwind CSS v4** via `@import "tailwindcss"` and **`@tailwindcss/postcss`** (`postcss.config.mjs`).
- **Design tokens** live in **`apps/web/src/app/globals.css`** (`:root`, `html[data-theme="dark"]`, and **`html[data-theme="system"]`** under `prefers-color-scheme` media queries).
- **Fonts:** **`next/font/google`** in **`layout.tsx`** — **Inter** (`--font-inter`), **JetBrains Mono** (`--font-jetbrains`). Body uses Inter + `antialiased`; monospace helper **`.font-mono-ledger`** for ledger-style UI.

## Theme switching

- Root **`layout.tsx`** sets **`<html lang="en" data-theme="system" suppressHydrationWarning>`**.
- **`useThemePreference`** (`apps/web/src/hooks/useThemePreference.ts`) — state `ThemePref`: **`system` | `light` | `dark`**; `useEffect` writes **`document.documentElement.setAttribute("data-theme", theme)`**.
- **`AppPreferencesProvider`** exposes **`theme` / `setTheme`** via **`useAppPreferences`** (wired in **`AppAuthenticatedProviders`**). Settings and onboarding surfaces change appearance here.

**Semantic tokens:** `:root` = light palette; **`html[data-theme="dark"]`** = explicit dark; **`html[data-theme="system"]`** duplicates light/dark via **`@media (prefers-color-scheme: …)`** so OS preference drives tokens when user chooses system.

## CSS variables (semantic)

| Token | Role |
|-------|------|
| `--bg`, `--fg` | Page-level background / foreground (also mapped into `@theme inline` as colors) |
| `--border`, `--border-subtle` | Dividers and subtle chrome |
| `--accent`, `--accent-hover`, `--on-accent` | Primary actions / focus lane — neutral zinc (dark fill light mode, light fill dark mode); text on primary uses `--on-accent` |
| `--muted` | Secondary text |
| `--surface-base`, `--surface-elevated`, `--surface-muted`, `--surface-hover`, `--surface-nav` | Layered surfaces |
| `--bg-header` | Solid header bar (`--surface-nav`-aligned) |
| `--accent-muted`, `--accent-glow`, `--accent-glow-soft` | Focus rings / glow washes |

## Primary actions (solid neutral)

Primary CTAs and the logo tile (**`.brand-mark`**) use **solid** `--accent` fills with **`--on-accent`** text — no frosted glass or backdrop blur. **`--shadow-primary`** is a light elevation shadow.

**`.surface-glass-primary`** keeps its historical class name but matches the same solid primary styling (used for selected chips / compact primary controls).

## Tailwind theme bridge (`@theme inline`)

Maps **`--color-bg`**, **`--color-fg`**, **`--color-border`**, **`--color-accent`**, **`--color-muted`** to the CSS vars above; sets **`--font-sans`** / **`--font-mono`** to the Next font variables.

**Radii:** Custom **`--radius-sm` … `--radius-4xl`** — intentionally ~25% tighter than default Tailwind scale (comment in file).

## Component-level classes (`globals.css`)

| Class | Use |
|-------|-----|
| **`.auth-shell`** / **`.auth-card`** | Centered login/register layout |
| **`.panel`** | Bordered elevated panel |
| **`.input`** / **`.input-compact`** | Form controls; focus ring uses `--accent` |
| **`select.input`, `select.input-compact`** | `appearance: none` + **inline SVG chevron** data-URI (light/dark/system variants) — fixes invisible native arrows on dark surfaces |
| **`.btn-primary`** | Solid neutral primary CTA |
| **`.btn-secondary`** | Elevated neutral button |
| **`.btn-ghost`** | Text/neutral hover |
| **`.btn`**, **`.btn-primary.legacy`**, **`.btn.btn-primary`** | Older combo selectors kept compatible |
| **`.surface-elevated`** | Background utility |
| **`.font-mono-ledger`** | JetBrains stack |

## Native controls & `color-scheme`

- **`color-scheme: light|dark`** set on `:root` / `html[data-theme="dark"]` / system branches — improves **native date/time** picker contrast (called out in inbox history vs react-day-picker migration).

## Where to extend

1. **New semantic colors** — add to `:root`, mirror in **`html[data-theme="dark"]`** and both **`prefers-color-scheme`** blocks for `system`, then optionally wire into **`@theme inline`** if you need Tailwind utilities.
2. **New reusable patterns** — prefer **classes in `globals.css`** + Tailwind in JSX for one-offs (existing codebase mixes both).
3. **Product-facing chrome** — **`AppHeader`**, **`WorkspaceSidebar`**, landing **`page.tsx`**, task **`work/page.tsx`** — search those for **`btn-primary`**, **`surface-*`**, Tailwind grids.

## Scope

- **`apps/mobile`** does **not** share this stylesheet (React Native styling is separate).
