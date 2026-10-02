import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: { ink: "#10302F", paper: "#F4F6F3", leaf: "#1F6F5C", saffron: "#E39A1B", line: "#DCE3DD" },
      fontFamily: { display: ["var(--font-display)", "Georgia", "serif"], sans: ["var(--font-body)", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
};
export default config;
