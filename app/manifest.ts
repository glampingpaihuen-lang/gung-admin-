import type { MetadataRoute } from "next";

/** Para instalar el panel en el celular o el computador como una app */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Panel Gung Ho",
    short_name: "Panel Gung Ho",
    description: "Sube las fotos de cada empresa a la página de Gung Ho.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#000000",
    theme_color: "#000000",
    lang: "es",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
