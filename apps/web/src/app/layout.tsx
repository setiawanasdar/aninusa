import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getSessionUser } from "@/lib/auth";
import { siteName, siteUrl } from "@/lib/env";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: `${siteName()} — Streaming Anime Subtitle Indonesia`,
    template: `%s · ${siteName()}`,
  },
  description:
    "Tonton anime dengan subtitle Indonesia, kualitas hingga 1080p, dan pengalaman streaming cepat di semua perangkat.",
  applicationName: siteName(),
  keywords: [
    "anime",
    "streaming anime",
    "subtitle indonesia",
    "nonton anime",
    "anime sub indo",
    "anime 1080p",
  ],
  authors: [{ name: siteName() }],
  openGraph: {
    type: "website",
    locale: "id_ID",
    siteName: siteName(),
    title: `${siteName()} — Streaming Anime Subtitle Indonesia`,
    description:
      "Tonton anime dengan subtitle Indonesia, kualitas hingga 1080p, dan pengalaman streaming cepat di semua perangkat.",
    url: siteUrl(),
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteName()} — Streaming Anime Subtitle Indonesia`,
    description: "Streaming anime subtitle Indonesia, kualitas hingga 1080p.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  icons: {
    icon: [
      { url: "/icon.svg?v=2", type: "image/svg+xml" },
      { url: "/favicon.ico?v=2", sizes: "any" },
    ],
    shortcut: "/favicon.ico?v=2",
    apple: "/apple-touch-icon.png?v=2",
  },
  alternates: { canonical: "/" },
};

export const viewport: Viewport = {
  themeColor: "#08080a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  colorScheme: "dark",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();

  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/icon.svg?v=2" type="image/svg+xml" />
        <link rel="alternate icon" href="/favicon.ico?v=2" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=2" />
      </head>
      <body className="flex min-h-screen flex-col">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
        >
          Lewati ke konten utama
        </a>
        <SiteHeader user={user ? { id: user.id, username: user.username, role: user.role, avatar: user.avatar } : null} />
        <main id="main-content" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
