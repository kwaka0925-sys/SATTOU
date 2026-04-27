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
        brand: {
          50: "#eef6ff",
          100: "#d9eaff",
          200: "#bcd9ff",
          300: "#8ec0ff",
          400: "#599dff",
          500: "#347aff",
          600: "#1f5cf5",
          700: "#1948dd",
          800: "#1a3dac",
          900: "#1c3a85",
        },
      },
    },
  },
  plugins: [],
};

export default config;
