import type { Metadata, Viewport } from "next";
import "@fontsource-variable/archivo/standard.css";
import "@fontsource/cinzel/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Panel Gung Ho", template: "%s · Panel Gung Ho" },
  description: "Panel para subir las fotos de cada empresa a la página de Gung Ho.",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Panel Gung Ho", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
