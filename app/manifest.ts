import type { MetadataRoute } from "next";

// The app's install file (served at /manifest.webmanifest and linked from every page by Next).
// "Install app" / "Add to Home screen" then gives the team an icon that opens the dashboard full
// screen, without the browser bars. The stage screen has its own manifest (per secret link).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Musabaqa",
    short_name: "Musabaqa",
    description: "Registration, judging and results of the Quran competition in Burundi.",
    id: "/",
    // The dashboard sends whoever is not logged in to the login page.
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "any",
    background_color: "#1A234E",
    theme_color: "#1A234E",
    lang: "fr",
    categories: ["education", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
