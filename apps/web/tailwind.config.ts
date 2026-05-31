import type { Config } from "tailwindcss";
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { display: ["var(--wl-display)"] },
      colors: {
        wl: {
          bg: "var(--wl-bg)", surface: "var(--wl-surface)",
          text: "var(--wl-text)", muted: "var(--wl-muted)", accent: "var(--wl-accent)",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
