import type { Metadata } from "next";
import { getThemeCookie } from "@/lib/theme/cookie";
import "./globals.css";

export const metadata: Metadata = {
  title: "TL-Radar",
  description: "Wer macht was und wo — ohne lange Nachfragen.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const theme = await getThemeCookie();

  return (
    <html lang="de" data-theme={theme}>
      <body>{children}</body>
    </html>
  );
}
