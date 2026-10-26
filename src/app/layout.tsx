import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  manifest: "/manifest.webmanifest",
  title: "Ke Mana — Navigasi Komuniti Malaysia",
  description:
    "Lapor bahaya, polis, sekatan jalan dan lihat kamera laju serta ciri jalan dari OpenStreetMap.",
  applicationName: "Ke Mana",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Ke Mana",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#05080c",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ms">
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
