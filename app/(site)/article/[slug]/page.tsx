import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCategories, getPostBySlug, getRelatedPosts } from "@/lib/queries";
import { PostGrid } from "@/components/site/PostGrid";
import { ArticleBadges } from "@/components/site/ArticleBadges";
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
  const description = post.tldr ?? post.summary ?? undefined;
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

  const [related, categories] = await Promise.all([getRelatedPosts(post), getCategories()]);

  // Resolve secondary topic ids → categories for chips.
  const secondary = post.secondary_category_ids
    .map((id) => categories.find((c) => c.id === id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  const image = post.thumbnail_url ?? post.image_url;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: post.title,
    datePublished: post.published_at ?? undefined,
    image: image ? [image] : undefined,
    author: post.author ? { "@type": "Person", name: post.author.name } : undefined,
    publisher: { "@type": "Organization", name: "Optimixed" },
    mainEntityOfPage: `${SITE_URL}/article/${post.slug}`,
    isBasedOn: post.url,
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
            <span>{post.category.name}</span>
          </>
        )}
      </nav>

      <article className="flex flex-col gap-6">
        <header className="flex flex-col gap-4">
          <h1 className="text-headline-large text-on-surface text-balance">{post.title}</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body-medium text-on-surface-variant">
            {post.source && (
              <Link href={`/source/${post.source.slug}`} className="hover:text-primary font-medium">
                {post.source.name}
              </Link>
            )}
            {post.author && (
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

        {(post.category || secondary.length > 0) && (
          <div className="flex flex-wrap items-center gap-2 border-t border-outline-variant pt-4">
            <span className="text-label-large text-on-surface-variant mr-1">Topics:</span>
            {post.category && <Chip>{post.category.name}</Chip>}
            {secondary.map((c) => (
              <Chip key={c.id}>{c.name}</Chip>
            ))}
          </div>
        )}
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
