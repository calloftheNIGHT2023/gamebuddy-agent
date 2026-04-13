import "./globals.css";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "GameBuddy Agent",
  description: "Open-source game analysis lab with browser-playable sandboxes, review demos, and a lightweight FastAPI backend."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
