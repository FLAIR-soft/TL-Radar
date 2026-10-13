import type { Metadata, Viewport } from "next";
import { getTheme } from "@/lib/theme/theme";
import { getLocale } from "@/lib/i18n/locale";
import "./globals.css";


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
  const [theme, locale] = await Promise.all([getTheme(), getLocale()]);

  return (
    <html lang={locale} data-theme={theme}>
      <body>{children}</body>
    </html>
  );
}
