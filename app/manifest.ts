import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ZION — Meet Kindly",
    short_name: "ZION",
    description: "A safer way to meet, chat and keep trusted friends.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#070812",
    theme_color: "#15132b",
    categories: ["social", "lifestyle"],
    icons: [
      { src: "/icons/zion-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/zion-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/zion-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
