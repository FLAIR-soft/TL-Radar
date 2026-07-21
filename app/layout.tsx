import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TL-Radar",
  description: "Кто чем занят и где — без лишних вопросов.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
