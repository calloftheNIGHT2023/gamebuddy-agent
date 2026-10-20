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
        ink: "#181b1e",
        mist: "#efeee8",
        pine: "#232a2d",
        ember: "#c34524",
        gold: "#e5f36a"
      },
      boxShadow: {
        card: "none"
      },
      fontFamily: {
        display: ["Arial Narrow", "Impact", "Microsoft YaHei", "sans-serif"],
        body: ["ui-sans-serif", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
