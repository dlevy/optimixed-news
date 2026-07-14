import type { MetadataRoute } from "next";
import { getCategories, getSitemapPosts, getSources } from "@/lib/queries";

export const revalidate = 3600;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.optimixed.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, sources, posts] = await Promise.all([
    getCategories(),
    getSources(),
    getSitemapPosts(),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "hourly", priority: 1 },
    { url: `${SITE_URL}/categories`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${SITE_URL}/sources`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${SITE_URL}/calendar`, changeFrequency: "daily", priority: 0.3 },
  ];

  const categoryRoutes: MetadataRoute.Sitemap = categories.map((c) => ({
    url: `${SITE_URL}/category/${c.slug}`,
    changeFrequency: "hourly",
    priority: 0.7,
  }));

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

  return [...staticRoutes, ...categoryRoutes, ...sourceRoutes, ...postRoutes];
}
