import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{ts,tsx}",
    "../../packages/player/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#08080a",
          900: "#0b0b0e",
          850: "#101014",
          800: "#141419",
          750: "#191920",
          700: "#1f1f27",
          600: "#2a2a34",
        },
        accent: {
          DEFAULT: "#ff3b5c",
          hover: "#e63350",
          soft: "rgba(255, 59, 92, 0.14)",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 10px 30px -18px rgba(0,0,0,0.9)",
        glow: "0 0 0 1px rgba(255,59,92,0.35), 0 12px 40px -20px rgba(255,59,92,0.55)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-up": "fade-up 320ms ease-out both",
        shimmer: "shimmer 1.6s infinite",
      },
    },
  },
  plugins: [],
};

export default config;
