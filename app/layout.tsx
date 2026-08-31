import type { Metadata } from "next";
import "./globals.css";
import { PwaInstall } from "./pwa-install";

export const metadata: Metadata = {
  title: "ZION",
  description: "Meet a stranger through one thoughtful question and ten honest minutes.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/icons/zion-192.png",
  },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "ZION" },
};

export const viewport = { themeColor: "#15132b", viewportFit: "cover" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}<PwaInstall /></body>
    </html>
  );
}
