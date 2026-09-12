import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      colors: {
        // Chotu warm saffron
        brand: {
          50: "#FFF7ED", 100: "#FFEDD5", 200: "#FED7AA", 300: "#FDBA74", 400: "#FB923C",
          500: "#F97316", 600: "#EA6A0C", 700: "#C2540A", 800: "#9A4309", 900: "#7C3608",
        },
        // dark sidebar / ink scale
        ink: {
          50: "#F6F7F9", 100: "#EEF0F3", 200: "#E2E5EA", 300: "#CBD0D8", 400: "#9AA3B0",
          500: "#6B7482", 600: "#4B5563", 700: "#2E3440", 800: "#1C2028", 900: "#12151B", 950: "#0B0D11",
        },
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.06)",
        pop: "0 8px 24px -8px rgba(16,24,40,.18)",
      },
      borderRadius: { xl2: "1rem" },
    },
  },
  plugins: [],
};
export default config;
