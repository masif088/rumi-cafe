import type { MetadataRoute } from "next";

// wajib untuk static export
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Rumi Cafe",
    short_name: "Rumi Cafe",
    description: "Kasir, stok, dan cash flow Rumi Cafe",
    lang: "id",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FAF6F1",
    theme_color: "#6F4E37",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Kasir", url: "/" },
      { name: "Transaksi", url: "/transaksi/" },
      { name: "Cash Flow", url: "/cashflow/" },
    ],
  };
}
