import type { MetadataRoute } from "next";
import { siteName } from "@/lib/env";

export const dynamic = "force-dynamic";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${siteName()} — Streaming Anime Subtitle Indonesia`,
    short_name: siteName(),
    description:
      "Streaming anime dengan subtitle Indonesia, kualitas hingga 1080p, di semua perangkat.",
    start_url: "/",
    display: "standalone",
    background_color: "#08080a",
    theme_color: "#08080a",
    lang: "id",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
