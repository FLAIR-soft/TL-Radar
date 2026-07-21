import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TL-Radar",
  description: "Wer macht was und wo — ohne lange Nachfragen.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
