import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#ffffff",
        surface: "#f8fafc",
        panel: "#f1f5f9",
        border: "#e2e8f0",
        accent: "#2563eb",
        "accent-dark": "#1d4ed8",
        "text-primary": "#0f172a",
        "text-muted": "#64748b",
        success: "#059669",
        error: "#dc2626",
        "school-blue": "#3b82f6",
      },
      fontFamily: {
        heading: ["var(--font-inter)", "sans-serif"],
        body: ["var(--font-inter)", "sans-serif"],
      },
      keyframes: {
        "skeleton-pulse": {
          "0%, 100%": { backgroundColor: "#f1f5f9" },
          "50%": { backgroundColor: "#e2e8f0" },
        },
      },
      animation: {
        "skeleton-pulse": "skeleton-pulse 1.5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
