import type { Metadata, Viewport } from "next";
// Шрифты ставятся файлами из пакета, а не грузятся с fonts.googleapis.com:
// у сборщика MIDAS нет доступа в интернет (на этом уже один раз упала сборка),
// да и дизайн-система требует самостоятельного хостинга.
//
// Titillium Web — рабочий шрифт MIFCOM; кириллицы и греческого у него нет,
// поэтому русский и греческий добирает Noto Sans: браузер подставляет его
// поглифно сам. JetBrains Mono — для времени, дат и всего измеримого.
// Берём только нужные начертания и подмножества, а не семейства целиком.
import "@fontsource/titillium-web/latin-400.css";
import "@fontsource/titillium-web/latin-600.css";
import "@fontsource/titillium-web/latin-700.css";
import "@fontsource/noto-sans/cyrillic-400.css";
import "@fontsource/noto-sans/cyrillic-600.css";
import "@fontsource/noto-sans/cyrillic-700.css";
import "@fontsource/noto-sans/greek-400.css";
import "@fontsource/jetbrains-mono/latin-400.css";
import "@fontsource/jetbrains-mono/latin-600.css";
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
