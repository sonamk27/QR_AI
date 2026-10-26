import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Theme tokens specified in design reference
        ivory: {
          DEFAULT: "#F7F2E9",
          50: "#FAF7F2",
          100: "#F7F2E9",
          200: "#EFE8DA",
          300: "#E5DBC7",
        },
        charcoal: {
          DEFAULT: "#24211E",
          50: "#F6F5F4",
          100: "#EAE7E4",
          200: "#D3CEC8",
          300: "#B8B1A8",
          400: "#8D8479",
          500: "#6B635B",
          600: "#514A43",
          700: "#3B3630",
          800: "#2C2824",
          900: "#24211E",
          950: "#1A1715",
        },
        gold: {
          DEFAULT: "#B58A4B",
          50: "#FCFAF6",
          100: "#F6EFE3",
          200: "#EBDFC7",
          300: "#DFCA9F",
          400: "#CBAA70",
          500: "#B58A4B",
          600: "#9E7438",
          700: "#7A5826",
          800: "#573E1B",
          900: "#382710",
        },
        warmBorder: {
          DEFAULT: "#E8DFD1",
          subtle: "#EFE8DC",
          strong: "#D8CBB6",
        },
        warmGray: {
          DEFAULT: "#716B64",
          light: "#9A928A",
          dark: "#4A453F",
        },
        // Mapped legacy tokens for full backward compatibility across all existing UI components
        ink: "#24211E",
        paper: "#F7F2E9",
        leaf: "#B58A4B",
        saffron: "#B58A4B",
        line: "#E8DFD1",
      },
      fontFamily: {
        display: ["var(--font-display)", "Playfair Display", "Georgia", "serif"],
        sans: ["var(--font-body)", "DM Sans", "system-ui", "sans-serif"],
        serif: ["var(--font-display)", "Playfair Display", "Georgia", "serif"],
      },
      boxShadow: {
        "2xs": "0 1px 2px 0 rgba(0, 0, 0, 0.03)",
        xs: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
        subtle: "0 1px 3px rgba(36, 33, 30, 0.05), 0 4px 12px rgba(36, 33, 30, 0.03)",
        elevated: "0 8px 24px rgba(36, 33, 30, 0.08)",
      },
      backdropBlur: {
        xs: "2px",
      },
      borderRadius: {
        card: "14px",
      },
    },
  },
  plugins: [],
};

export default config;
