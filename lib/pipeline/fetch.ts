import Parser from "rss-parser";
import { XMLParser } from "fast-xml-parser";
import type { Source } from "@/lib/types";

export interface CandidateItem {
  guid: string | null;
  url: string;
  title: string;
  excerpt: string | null;
  imageUrl: string | null;
  author: string | null;
  publishedAt: string | null; // ISO
}

const USER_AGENT = "OptimixedBot/1.0 (+https://www.optimixed.com)";
const MAX_SITEMAP_ITEMS = 25; // cap page-fetches for title enrichment

const rss = new Parser({
  headers: { "User-Agent": USER_AGENT },
  customFields: {
    item: [
      ["media:content", "media"],
      ["content:encoded", "contentEncoded"],
    ],
  },
});

function stripHtml(html: string | undefined | null): string | null {
  if (!html) return null;
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text || null;
}

function clamp(s: string | null, n = 1500): string | null {
  if (!s) return s;
  return s.length > n ? s.slice(0, n) : s;
}

/** Fetch a source and return normalized candidate items. */
export async function fetchSource(source: Source): Promise<CandidateItem[]> {
  return source.kind === "sitemap" ? fetchSitemap(source) : fetchRss(source);
}

async function fetchRss(source: Source): Promise<CandidateItem[]> {
  const feed = await rss.parseURL(source.feed_url);
  return (feed.items ?? []).flatMap((item): CandidateItem[] => {
    const url = (item.link ?? "").trim();
    const title = (item.title ?? "").trim();
    if (!url || !title) return [];
    // rss-parser's Item is loosely typed; reach non-standard fields via an explicit view.
    const it = item as unknown as {
      id?: string;
      media?: { $?: { url?: string } };
      contentEncoded?: string;
      "dc:creator"?: string;
    };
    const media = it.media;
    return [
      {
        guid: item.guid ?? it.id ?? url,
        url,
        title,
        excerpt: clamp(
          item.contentSnippet?.trim() ||
            stripHtml(it.contentEncoded) ||
            stripHtml(item.content),
        ),
        imageUrl: item.enclosure?.url ?? media?.$?.url ?? null,
        author: item.creator ?? it["dc:creator"] ?? null,
        publishedAt: toIso(item.isoDate ?? item.pubDate),
      },
    ];
  });
}

async function fetchSitemap(source: Source): Promise<CandidateItem[]> {
  const res = await fetch(source.feed_url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Sitemap fetch failed: ${res.status}`);
  const xml = await res.text();
  const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true });
  const doc = parser.parse(xml);

  const rawUrls = doc?.urlset?.url;
  const urls: Record<string, unknown>[] = Array.isArray(rawUrls) ? rawUrls : rawUrls ? [rawUrls] : [];

  const entries = urls
    .map((u) => ({
      loc: String(u.loc ?? "").trim(),
      lastmod: toIso(u.lastmod as string | undefined),
      // Google News sitemaps embed <news:title>/<news:publication_date>
      newsTitle: (u.news as Record<string, unknown> | undefined)?.title as string | undefined,
      newsDate: toIso(
        ((u.news as Record<string, unknown> | undefined)?.publication_date as string) || undefined,
      ),
    }))
    .filter((e) => e.loc)
    .sort((a, b) => (b.lastmod ?? "").localeCompare(a.lastmod ?? ""))
    .slice(0, MAX_SITEMAP_ITEMS);

  const items = await Promise.all(
    entries.map(async (e): Promise<CandidateItem | null> => {
      if (e.newsTitle) {
        return {
          guid: e.loc,
          url: e.loc,
          title: e.newsTitle,
          excerpt: null,
          imageUrl: null,
          author: null,
          publishedAt: e.newsDate ?? e.lastmod,
        };
      }
      const meta = await fetchMeta(e.loc);
      if (!meta?.title) return null;
      return {
        guid: e.loc,
        url: e.loc,
        title: meta.title,
        excerpt: clamp(meta.description),
        imageUrl: meta.image,
        author: null,
        publishedAt: e.lastmod,
      };
    }),
  );

  return items.filter((i): i is CandidateItem => i !== null);
}

/** Extract og/meta title, description, image from a page's HTML head. */
async function fetchMeta(
  url: string,
): Promise<{ title: string | null; description: string | null; image: string | null } | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) return null;
    const html = (await res.text()).slice(0, 60_000); // head is early
    const meta = (prop: string) =>
      html.match(
        new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i"),
      )?.[1] ??
      html.match(
        new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, "i"),
      )?.[1] ??
      null;
    const title =
      meta("og:title") ?? html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? null;
    return {
      title: title ? decodeEntities(title) : null,
      description: meta("og:description") ?? meta("description"),
      image: meta("og:image"),
    };
  } catch {
    return null;
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function toIso(v: string | undefined | null): string | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}
