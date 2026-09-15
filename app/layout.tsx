import OnlineCount from "./online-count";
import LightCord from "./light-cord";
import type { Metadata } from "next";
import "@fontsource-variable/montserrat";
import "./globals.css";
import "@livekit/components-styles";
import { PwaInstall } from "./pwa-install";
import { LanguageSwitcher } from "./language-switcher";

export const metadata: Metadata = {
  metadataBase: new URL("https://zion-one-nu.vercel.app"),
  title: "ZION — Stranger Chat, Friends & Social Games",
  description:
    "Meet new people on ZION, chat with friends, share photos, videos and links, and explore social games. Read our public features, privacy and safety guides.",
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
        <LightCord />
        <OnlineCount />
        <LanguageSwitcher />
        <PwaInstall />
      </body>
    </html>
  );
}
