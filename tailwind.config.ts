import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Every entry below reads from the `-rgb` variables
        // (app/globals.css), not the plain hex ones — this is what
        // makes bg-accent/10, border-void/20, etc. actually apply
        // real transparency, sitewide. Confirmed broken with the
        // previous (bare var(--color-x)) format on two components via
        // direct screenshot testing before this was generalized: a
        // bare CSS variable holding a hex string can't have Tailwind
        // interpolate an alpha channel into it, so every opacity
        // modifier on every one of these colors was either being
        // silently dropped or falling back to full opacity. The plain
        // hex variables (--color-x, no -rgb suffix) still exist
        // unchanged in globals.css for the many places across the
        // codebase that use var(--color-x) directly as a standalone
        // color value (SVG stroke/fill, inline styles, box-shadow) —
        // this file no longer reads those directly, only the new
        // -rgb ones, so nothing about that direct usage is affected.

        // Base surfaces
        void: "rgb(var(--color-void-rgb) / <alpha-value>)",
        surface: "rgb(var(--color-surface-rgb) / <alpha-value>)",
        "surface-raised": "rgb(var(--color-surface-raised-rgb) / <alpha-value>)",
        border: {
          DEFAULT: "rgb(var(--color-border-rgb) / <alpha-value>)",
          strong: "rgb(var(--color-border-strong-rgb) / <alpha-value>)",
        },
        // Text
        ink: {
          DEFAULT: "rgb(var(--color-ink-rgb) / <alpha-value>)",
          secondary: "rgb(var(--color-ink-secondary-rgb) / <alpha-value>)",
          tertiary: "rgb(var(--color-ink-tertiary-rgb) / <alpha-value>)",
        },
        // Signature accent — "spotlight blue" (draft grade / spotlight)
        accent: {
          DEFAULT: "rgb(var(--color-accent-rgb) / <alpha-value>)",
          dim: "rgb(var(--color-accent-dim-rgb) / <alpha-value>)",
          soft: "rgb(var(--color-accent-soft-rgb) / <alpha-value>)",
        },
        // Movement indicators
        riser: "rgb(var(--color-riser-rgb) / <alpha-value>)",
        faller: "rgb(var(--color-faller-rgb) / <alpha-value>)",
      },
      fontFamily: {
        display: ["var(--font-body)"],
        body: ["var(--font-body)"],
        mono: ["var(--font-mono)"],
        // The new, separate display face — see app/layout.tsx's own
        // comment for why this isn't just remapped onto `display`.
        headline: ["var(--font-headline)"],
      },
      backgroundImage: {
        "grid-columns":
          "repeating-linear-gradient(90deg, rgba(20,22,27,0.025) 0px, rgba(20,22,27,0.025) 1px, transparent 1px, transparent 120px)",
        // A second, sparingly-used texture — horizontal ruled lines
        // with a tick mark at the start of each, closer to a
        // scouting stat sheet or a measuring tape than to a typical
        // SaaS grid backdrop. Meant for one or two specific moments,
        // not as a default background.
        "rule-lines":
          "repeating-linear-gradient(180deg, rgba(237,239,242,0.05) 0px, rgba(237,239,242,0.05) 1px, transparent 1px, transparent 48px)",
      },
      letterSpacing: {
        tightest: "-0.045em",
        widest2: "0.28em",
      },
    },
  },
  plugins: [],
};

export default config;
