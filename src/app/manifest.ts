import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "REDLINK — Blood availability & donor coordination",
    short_name: "REDLINK",
    description: "Freshness-aware blood availability search and emergency donor coordination.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f5f0e7",
    theme_color: "#782a38",
    categories: ["medical", "health"],
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512?maskable=1", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Request blood", url: "/request-blood" },
      { name: "Find blood", url: "/availability" },
    ],
  };
}
