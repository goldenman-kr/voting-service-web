import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/app/**/*.{ts,tsx}", "./src/components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef6ff",
          600: "#2563eb",
          700: "#1d4ed8"
        },
        danger: {
          50: "#fff1f2",
          600: "#e11d48",
          700: "#be123c"
        },
        warning: {
          50: "#fffbeb",
          600: "#d97706",
          700: "#b45309"
        }
      }
    }
  },
  plugins: []
};

export default config;
