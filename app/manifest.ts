import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  const name = process.env.NEXT_PUBLIC_APP_NAME || "Filomina";
  return {
    name: `${name} · AI photo finder`,
    short_name: name,
    description: "Find people in the photos of a shared Google Drive.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f7fc",
    theme_color: "#3b82f6",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
