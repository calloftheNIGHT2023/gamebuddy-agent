// 前端根布局，统一注入全局样式和页面元信息。
import "./globals.css";
import "./field-game.css";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "GameBuddy — 松风镇、河谷争夺与地牢余火",
  description: "找回补给、抢占河谷、穿过地牢。三款像素小游戏，随时查看当前战局，接着玩。"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
