import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fff7ed",
          100: "#ffedd5",
          200: "#fed7aa",
          300: "#fdba74",
          400: "#fb923c",
          500: "#f97316",
          600: "#ea580c",
          700: "#c2410c",
          900: "#7c2d12",
        },
        ink: {
          950: "#030712",
          900: "#0b1220",
          800: "#111827",
          700: "#1f2937",
          500: "#6b7280",
          300: "#d1d5db",
          200: "#e5e7eb",
          100: "#f3f4f6",
          50: "#f9fafb",
        },
      },
      fontFamily: {
        display: ['"Unbounded"', "system-ui", "sans-serif"],
        sans: ['"Inter"', "system-ui", "sans-serif"],
      },
      boxShadow: {
        glass: "0 20px 60px -20px rgba(17, 24, 39, 0.25)",
        pop: "0 10px 30px -12px rgba(249, 115, 22, 0.45)",
      },
      backgroundImage: {
        "noise":
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.12 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
      },
    },
  },
  plugins: [],
} satisfies Config;
