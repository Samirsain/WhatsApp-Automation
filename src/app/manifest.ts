import type { MetadataRoute } from "next";

/** Lets Android and iOS install the dashboard to the home screen as an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "3% Club",
    short_name: "3% Club",
    description: "WhatsApp automation and customer management dashboard for the 3% Club.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
