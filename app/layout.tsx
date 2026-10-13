import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import { getThemeCookie } from "@/lib/theme/cookie";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TL-Organizer",
  description: "Wer macht was und wo — ohne lange Nachfragen.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TL-Organizer",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#EDEDED" },
    { media: "(prefers-color-scheme: dark)", color: "#1B1B1B" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const theme = await getThemeCookie();

  return (
    <html lang="de" data-theme={theme} className={archivo.variable}>
      <body>{children}</body>
    </html>
  );
}
