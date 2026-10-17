import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";

// Runtime generation keeps the canonical host correct after deployment.
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/admin/", "/api/", "/profile", "/login", "/register", "/search"],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: siteUrl(),
  };
}
