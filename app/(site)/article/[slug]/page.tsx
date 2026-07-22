import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCategories, getPostBySlug, getPostSources, getRelatedPosts } from "@/lib/queries";
import { PostGrid } from "@/components/site/PostGrid";
import { ArticleBadges } from "@/components/site/ArticleBadges";
import { ExclusiveBadge } from "@/components/site/ExclusiveBadge";
import { ArticleBody } from "@/components/site/ArticleBody";
import { SourceList } from "@/components/site/SourceList";
import { ShareButtons } from "@/components/site/ShareButtons";
import { Chip } from "@/components/md/Chip";
import { Button } from "@/components/md/Button";
import { Icon } from "@/components/md/Icon";
import { formatDate } from "@/lib/format";

export const revalidate = 300;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.optimixed.com";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return {};
  const description = post.dek ?? post.tldr ?? post.summary ?? undefined;
  const ogImage = post.thumbnail_url ?? post.image_url ?? undefined;
  return {
    title: post.title,
    description,
    alternates: { canonical: `/article/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description,
      publishedTime: post.published_at ?? undefined,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  const exclusive = post.origin === "internal";
  const [related, categories, sources] = await Promise.all([
    getRelatedPosts(post),
    getCategories(),
    exclusive ? getPostSources(post.id) : Promise.resolve([]),
  ]);

  // Resolve secondary topic ids → categories for chips.
  const secondary = post.secondary_category_ids
    .map((id) => categories.find((c) => c.id === id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  const image = post.thumbnail_url ?? post.image_url;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: post.title,
    description: post.dek ?? post.tldr ?? undefined,
    datePublished: post.published_at ?? undefined,
    dateModified: post.updated_at,
    image: image ? [image] : undefined,
    // Exclusives are Optimixed's own reporting; aggregated posts credit the writer.
    author: exclusive
      ? { "@type": "Organization", name: "Optimixed", url: SITE_URL }
      : post.author
        ? { "@type": "Person", name: post.author.name }
        : undefined,
    publisher: { "@type": "Organization", name: "Optimixed" },
    mainEntityOfPage: `${SITE_URL}/article/${post.slug}`,
    // An exclusive is based on every source consulted, not a single article.
    isBasedOn: exclusive
      ? sources.map((s) => s.url).filter((u): u is string => Boolean(u))
      : post.url,
    citation: exclusive
      ? sources
          .filter((s) => s.url)
          .map((s) => ({
            "@type": "CreativeWork",
            name: s.title ?? undefined,
            url: s.url ?? undefined,
            publisher: s.publisher ? { "@type": "Organization", name: s.publisher } : undefined,
          }))
      : undefined,
    articleSection: post.category?.name,
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Breadcrumb */}
      <nav className="mb-4 text-label-large text-on-surface-variant flex items-center gap-1">
        <Link href="/" className="hover:text-primary">
          Home
        </Link>
        {post.category && (
          <>
            <Icon name="chevron_right" className="text-[18px]" />
            <Link href={`/?cats=${post.category.slug}`} className="hover:text-primary">
              {post.category.name}
            </Link>
          </>
        )}
      </nav>

      <article className="flex flex-col gap-6">
        <header className="flex flex-col gap-4">
          {exclusive && <ExclusiveBadge size="large" className="self-start" />}
          <h1 className="text-headline-large text-on-surface text-balance">{post.title}</h1>
          {exclusive && post.dek && (
            <p className="text-title-medium text-on-surface-variant text-balance">{post.dek}</p>
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body-medium text-on-surface-variant">
            {exclusive ? (
              <span className="font-medium text-on-surface">By Optimixed</span>
            ) : (
              post.source && (
                <Link
                  href={`/source/${post.source.slug}`}
                  className="hover:text-primary font-medium"
                >
                  {post.source.name}
                </Link>
              )
            )}
            {!exclusive && post.author && (
              <>
                <span aria-hidden>·</span>
                <Link href={`/author/${post.author.slug}`} className="hover:text-primary">
                  {post.author.name}
                </Link>
              </>
            )}
            {post.published_at && (
              <>
                <span aria-hidden>·</span>
                <time dateTime={post.published_at}>{formatDate(post.published_at)}</time>
              </>
            )}
            {exclusive && sources.length > 0 && (
              <>
                <span aria-hidden>·</span>
                <span>
                  {sources.length} source{sources.length === 1 ? "" : "s"}
                </span>
              </>
            )}
          </div>
          <ArticleBadges post={post} />
        </header>

        {post.thumbnail_url && (
          <div className="overflow-hidden rounded-lg bg-surface-container-high w-fit">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.thumbnail_url}
              alt=""
              className="max-w-[280px] w-full object-cover"
            />
          </div>
        )}

        {exclusive ? (
          post.body_md && <ArticleBody markdown={post.body_md} />
        ) : (
          <>
            {post.tldr && (
              <div className="rounded-lg bg-primary-container text-on-primary-container p-5">
                <p className="text-label-large mb-1 flex items-center gap-1">
                  <Icon name="bolt" filled className="text-[18px]" />
                  TLDR
                </p>
                <p className="text-title-medium">{post.tldr}</p>
              </div>
            )}

            {post.summary && (
              <div className="text-body-large text-on-surface leading-relaxed whitespace-pre-line">
                {post.summary}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button href={post.url} variant="filled">
                <Icon name="open_in_new" className="text-[18px]" />
                Read full article
                {post.source ? ` at ${post.source.name}` : ""}
              </Button>
            </div>
          </>
        )}

        {(post.category || secondary.length > 0) && (
          <div className="flex flex-wrap items-center gap-2 border-t border-outline-variant pt-4">
            <span className="text-label-large text-on-surface-variant mr-1">Topics:</span>
            {post.category && (
              <Chip href={`/?cats=${post.category.slug}`}>{post.category.name}</Chip>
            )}
            {secondary.map((c) => (
              <Chip key={c.id} href={`/?cats=${c.slug}`}>
                {c.name}
              </Chip>
            ))}
          </div>
        )}

        {exclusive && <SourceList sources={sources} />}

        <ShareButtons url={`${SITE_URL}/article/${post.slug}`} title={post.title} />
      </article>

      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="text-title-large text-on-surface mb-4">Related articles</h2>
          <PostGrid posts={related} />
        </section>
      )}
    </main>
  );
}
