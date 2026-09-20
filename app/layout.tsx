import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "skillradar",
  description: "GitHub-backed Agent Skills directory with anti-slop scoring.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <body>
        <header>
          <nav>
            <div className="brand">skillradar</div>
            <a href="https://github.com/bjo4/skillradar">GitHub</a>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
