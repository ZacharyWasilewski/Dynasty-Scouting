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
        // Base surfaces
        void: "var(--color-void)",
        surface: "var(--color-surface)",
        "surface-raised": "var(--color-surface-raised)",
        border: {
          DEFAULT: "var(--color-border)",
          strong: "var(--color-border-strong)",
        },
        // Text
        ink: {
          DEFAULT: "var(--color-ink)",
          secondary: "var(--color-ink-secondary)",
          tertiary: "var(--color-ink-tertiary)",
        },
        // Signature accent — "spotlight blue" (draft grade / spotlight)
        accent: {
          DEFAULT: "var(--color-accent)",
          dim: "var(--color-accent-dim)",
          soft: "var(--color-accent-soft)",
        },
        // Movement indicators
        riser: "var(--color-riser)",
        faller: "var(--color-faller)",
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
          "repeating-linear-gradient(90deg, rgba(237,239,242,0.035) 0px, rgba(237,239,242,0.035) 1px, transparent 1px, transparent 120px)",
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
