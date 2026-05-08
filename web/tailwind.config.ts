import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Surface
        ink:   "#0a0a0a",
        coal:  "#141414",
        shade: "#1c1c1c",
        rule:  "#262626",
        // Text
        bone:  "#fafafa",
        ash:   "#a3a3a3",
        smoke: "#737373",
        // Signal
        beam:  "#ffb020",   // beacon amber, primary accent
        beam2: "#ffd166",   // hover/highlight
        // Status
        live:  "#34d399",   // indexed
        warn:  "#fbbf24",   // not indexed
        fail:  "#f87171",   // error
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "ui-serif", "serif"],
        body:    ["var(--font-plex-sans)", "ui-sans-serif", "system-ui"],
        mono:    ["var(--font-jetbrains-mono)", "ui-monospace", "monospace"],
      },
      letterSpacing: {
        tightest: "-0.04em",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(255,176,32,0.4), 0 8px 32px -8px rgba(255,176,32,0.25)",
      },
      animation: {
        sweep: "sweep 2.4s ease-in-out infinite",
        rise:  "rise 600ms cubic-bezier(0.2, 0.8, 0.2, 1) both",
      },
      keyframes: {
        sweep: {
          "0%, 100%": { transform: "translateX(-100%)" },
          "50%":      { transform: "translateX(100%)" },
        },
        rise: {
          "0%":   { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
