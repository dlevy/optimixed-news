import type { MetadataRoute } from "next";
import { getSitemapPosts, getSources } from "@/lib/queries";

export const revalidate = 3600;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.optimixed.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [sources, posts] = await Promise.all([getSources(), getSitemapPosts()]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "hourly", priority: 1 },
    { url: `${SITE_URL}/sources`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${SITE_URL}/calendar`, changeFrequency: "daily", priority: 0.3 },
  ];

  const sourceRoutes: MetadataRoute.Sitemap = sources.map((s) => ({
    url: `${SITE_URL}/source/${s.slug}`,
    changeFrequency: "daily",
    priority: 0.4,
  }));

  const postRoutes: MetadataRoute.Sitemap = posts.map((p) => ({
    url: `${SITE_URL}/article/${p.slug}`,
    lastModified: p.updated_at,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...sourceRoutes, ...postRoutes];
}
