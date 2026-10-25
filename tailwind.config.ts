import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: { 950: "#060d1f", 900: "#0a1530", 800: "#0f1f44", 700: "#18305f", 600: "#24427f" },
        signal: { DEFAULT: "#2ee59d", dim: "#1aa874" },
      },
      fontFamily: { sans: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"] },
    },
  },
  plugins: [],
};
export default config;
