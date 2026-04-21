// Tailwind 主题配置，统一维护颜色、阴影和字体扩展。
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#101826",
        mist: "#eef4f8",
        pine: "#16352b",
        ember: "#c75a2b",
        gold: "#e8c86a"
      },
      boxShadow: {
        card: "0 20px 60px rgba(16, 24, 38, 0.08)"
      },
      fontFamily: {
        display: ["Georgia", "Times New Roman", "serif"],
        body: ["ui-sans-serif", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
