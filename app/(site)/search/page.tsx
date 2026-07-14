import type { Metadata } from "next";
import { getPosts } from "@/lib/queries";
import { Feed } from "@/components/site/Feed";
import { Icon } from "@/components/md/Icon";

export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const posts = query ? await getPosts({ search: query, limit: 48 }) : [];

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <h1 className="text-headline-large text-on-surface mb-6">Search</h1>

      <form action="/search" className="mb-8 max-w-xl">
        <div className="flex items-center gap-2 h-14 rounded-full bg-surface-container-high px-5 focus-within:outline-2 focus-within:outline-primary">
          <Icon name="search" className="text-on-surface-variant" />
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search articles…"
            autoFocus
            className="flex-1 bg-transparent outline-none text-body-large text-on-surface"
          />
        </div>
      </form>

      {query ? (
        <>
          <p className="mb-4 text-body-medium text-on-surface-variant">
            {posts.length} result{posts.length === 1 ? "" : "s"} for “{query}”
          </p>
          <Feed posts={posts} emptyLabel={`No results for “${query}”.`} />
        </>
      ) : (
        <p className="text-body-large text-on-surface-variant">
          Enter a search term to find articles across every source.
        </p>
      )}
    </main>
  );
}
