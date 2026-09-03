import type { Metadata } from "next";
import "@fontsource-variable/montserrat";
import "./globals.css";
import "@livekit/components-styles";
import { PwaInstall } from "./pwa-install";
import { LanguageSwitcher } from "./language-switcher";

export const metadata: Metadata = {
  title: "ZION",
  description:
    "Meet a stranger through one thoughtful question and ten honest minutes.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/icons/zion-192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ZION",
  },
};

export const viewport = { themeColor: "#15132b", viewportFit: "cover" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
        <LanguageSwitcher />
        <PwaInstall />
      </body>
    </html>
  );
}
