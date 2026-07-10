import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/app/**/*.{ts,tsx}", "./src/components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#EDF2FD",
          100: "#DBE6FB",
          600: "#6180DB",
          700: "#5570C9",
          800: "#4258A8",
          950: "#101D33"
        },
        blue: {
          50: "#EDF2FD",
          100: "#DBE6FB",
          200: "#DBE6FB",
          500: "#6180DB",
          600: "#6180DB",
          700: "#6180DB",
          800: "#5570C9",
          900: "#4258A8",
          950: "#101D33"
        },
        slate: {
          50: "#F7F9FC",
          100: "#EEF1F6",
          200: "#E9EDF3",
          300: "#D8DEE9",
          400: "#A6AEBC",
          500: "#8A93A4",
          600: "#6B7688",
          700: "#48546B",
          800: "#2A3852",
          900: "#1B2A44",
          950: "#101D33"
        },
        emerald: {
          50: "#E9F6EF",
          100: "#E9F6EF",
          200: "#CDE9D8",
          700: "#1F7A4D",
          800: "#1F7A4D",
          900: "#195F3D",
          950: "#134832"
        },
        red: {
          50: "#FCF2F2",
          100: "#F8E5E5",
          200: "#E7C3C3",
          700: "#B4322F",
          800: "#9D2927",
          900: "#7D211F"
        },
        amber: {
          50: "#FBF6EA",
          100: "#F6EDD9",
          200: "#F0E4C8",
          700: "#8A6516",
          800: "#70510F",
          900: "#59400C",
          950: "#3F2D08"
        },
        ink: {
          DEFAULT: "#101D33",
          soft: "#1B2A44",
          body: "#48546B",
          muted: "#6B7688",
          faint: "#8A93A4"
        },
        canvas: "#F4F6FA",
        surface: "#F7F9FC",
        line: {
          DEFAULT: "#E9EDF3",
          input: "#D8DEE9"
        },
        gold: {
          DEFAULT: "#B7893B",
          light: "#C39A54",
          tint: "#F4EBD6"
        },
        danger: {
          50: "#FCF2F2",
          200: "#E7C3C3",
          600: "#B4322F",
          700: "#9D2927"
        },
        warning: {
          50: "#FBF6EA",
          200: "#F0E4C8",
          600: "#8A6516",
          700: "#70510F"
        }
      },
      fontFamily: {
        sans: ["A2z", "Pretendard", "system-ui", "sans-serif"]
      },
      borderRadius: {
        md: "10px",
        lg: "12px",
        xl: "14px",
        card: "16px",
        control: "10px"
      },
      boxShadow: {
        card: "0 16px 42px -30px rgba(16, 29, 51, 0.32)",
        primary: "0 12px 26px -10px rgba(97, 128, 219, 0.65)",
        hero: "0 34px 64px -26px rgba(16, 29, 51, 0.34)",
        float: "0 24px 48px -18px rgba(16, 29, 51, 0.5)"
      }
    }
  },
  plugins: []
};

export default config;
