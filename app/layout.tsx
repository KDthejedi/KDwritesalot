import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KDwritesalot — Screenplay Studio",
  description:
    "Write screenplays collaboratively, export copyright-ready PDF and Final Draft files, and keep a timestamped version history.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
