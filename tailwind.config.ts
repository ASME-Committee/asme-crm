import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0b1020",
        // ASME brand blue, sampled from the master logo (matches the website).
        brand: {
          DEFAULT: "#1F63EF",
          deep: "#275EE7",
          light: "#5288F2",
          soft: "#A8C7F9",
          wash: "#EEF3FE",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
