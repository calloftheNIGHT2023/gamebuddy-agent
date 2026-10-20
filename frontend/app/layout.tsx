// 前端根布局，统一注入全局样式和页面元信息。
import "./globals.css";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "GameBuddy — 游戏攻略与复盘工作台",
  description: "回合策略、MOBA 复盘与 RPG 养成。用局势、知识来源和行动清单，找到下一步。"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
