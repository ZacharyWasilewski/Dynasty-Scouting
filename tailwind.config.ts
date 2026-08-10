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
        void: "#0A0C0F",
        surface: "#12151A",
        "surface-raised": "#181C22",
        border: {
          DEFAULT: "#232830",
          strong: "#2E343E",
        },
        // Text
        ink: {
          DEFAULT: "#EDEFF2",
          secondary: "#9BA3AF",
          tertiary: "#5C6470",
        },
        // Signature accent — "spotlight blue" (draft grade / spotlight)
        accent: {
          DEFAULT: "#3B82F6",
          dim: "#1E40AF",
          soft: "#93C5FD",
        },
        // Movement indicators
        riser: "#4ADE80",
        faller: "#F87171",
      },
      fontFamily: {
        display: ["var(--font-body)"],
        body: ["var(--font-body)"],
        mono: ["var(--font-mono)"],
      },
      backgroundImage: {
        "grid-columns":
          "repeating-linear-gradient(90deg, rgba(237,239,242,0.035) 0px, rgba(237,239,242,0.035) 1px, transparent 1px, transparent 120px)",
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
