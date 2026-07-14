import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPosts, getSourceBySlug } from "@/lib/queries";
import { Feed } from "@/components/site/Feed";
import { Pagination } from "@/components/site/Pagination";
import { Icon } from "@/components/md/Icon";

export const revalidate = 300;
const PAGE_SIZE = 24;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const source = await getSourceBySlug(slug);
  if (!source) return {};
  return { title: source.name, description: `Latest articles from ${source.name}.` };
}

export default async function SourcePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const source = await getSourceBySlug(slug);
  if (!source) notFound();

  const offset = (page - 1) * PAGE_SIZE;
  const posts = await getPosts({ sourceId: source.id, limit: PAGE_SIZE, offset });

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <header className="mb-8">
        <p className="text-label-large text-primary">Source</p>
        <h1 className="text-headline-large text-on-surface">{source.name}</h1>
        {source.homepage_url && (
          <a
            href={source.homepage_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 mt-2 text-body-medium text-on-surface-variant hover:text-primary"
          >
            <Icon name="open_in_new" className="text-[18px]" />
            Visit website
          </a>
        )}
      </header>

      <Feed posts={posts} startIndex={offset} emptyLabel={`No articles from ${source.name} yet.`} />

      <Pagination
        basePath={`/source/${source.slug}`}
        page={page}
        hasNext={posts.length === PAGE_SIZE}
      />
    </main>
  );
}
