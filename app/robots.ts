import type { MetadataRoute } from "next";

// Nothing here is for search engines: the team's pages are behind the access gate, and the
// public pages (registration, results, stage screen) are reached through links the organisation
// shares itself.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
