import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCategories, getCategoryBySlug, getPosts, getPostsCount } from "@/lib/queries";
import { CategoryChips } from "@/components/site/CategoryChips";
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
  const category = await getCategoryBySlug(slug);
  if (!category) return {};
  return {
    title: category.name,
    description: `The latest ${category.name} news, curated and summarized.`,
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const category = await getCategoryBySlug(slug);
  if (!category) notFound();

  const offset = (page - 1) * PAGE_SIZE;
  const [categories, posts, total] = await Promise.all([
    getCategories(),
    getPosts({ categoryId: category.id, limit: PAGE_SIZE, offset }),
    getPostsCount({ categoryId: category.id }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const countLabel = `${total.toLocaleString()} article${total === 1 ? "" : "s"} · Page ${page} of ${totalPages}`;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <header className="mb-6">
        <p className="text-label-large text-primary">Category</p>
        <h1 className="text-headline-large text-on-surface">{category.name}</h1>
      </header>

      <section className="mb-8">
        <CategoryChips categories={categories} activeSlug={category.slug} />
      </section>

      <Feed
        posts={posts}
        startIndex={offset}
        toolbarStart={countLabel}
        emptyLabel={`No articles in ${category.name} yet.`}
      />

      <Pagination basePath={`/category/${category.slug}`} page={page} totalPages={totalPages} />
    </main>
  );
}
