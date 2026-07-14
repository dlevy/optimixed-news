import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAuthorBySlug, getPosts } from "@/lib/queries";
import { Feed } from "@/components/site/Feed";
import { Pagination } from "@/components/site/Pagination";

export const revalidate = 300;
const PAGE_SIZE = 24;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const author = await getAuthorBySlug(slug);
  if (!author) return {};
  return { title: author.name, description: `Articles by ${author.name}.` };
}

export default async function AuthorPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const author = await getAuthorBySlug(slug);
  if (!author) notFound();

  const offset = (page - 1) * PAGE_SIZE;
  const posts = await getPosts({ authorId: author.id, limit: PAGE_SIZE, offset });

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <header className="mb-8">
        <p className="text-label-large text-primary">Author</p>
        <h1 className="text-headline-large text-on-surface">{author.name}</h1>
      </header>

      <Feed posts={posts} startIndex={offset} emptyLabel={`No articles by ${author.name} yet.`} />

      <Pagination basePath={`/author/${author.slug}`} page={page} hasNext={posts.length === PAGE_SIZE} />
    </main>
  );
}
