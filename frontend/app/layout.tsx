import "./globals.css";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "GameBuddy Agent",
  description: "Open-source AI gaming coach for turn-based battle analysis."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
