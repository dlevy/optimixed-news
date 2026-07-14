import { getCategories, getPosts } from "@/lib/queries";
import { CategoryChips } from "@/components/site/CategoryChips";
import { FilterBar } from "@/components/site/FilterBar";
import { Feed } from "@/components/site/Feed";
import { Pagination } from "@/components/site/Pagination";

export const revalidate = 300; // ISR: refresh every 5 min

const PAGE_SIZE = 24;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function dayRange(date: string): { start: string; end: string } {
  const d = new Date(`${date}T00:00:00Z`);
  const next = new Date(d);
  next.setUTCDate(next.getUTCDate() + 1);
  return { start: d.toISOString(), end: next.toISOString() };
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; date?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;
  const q = (sp.q ?? "").trim();
  const date = DATE_RE.test(sp.date ?? "") ? sp.date! : "";
  const range = date ? dayRange(date) : null;
  const filtering = Boolean(q || date);

  const [categories, posts] = await Promise.all([
    getCategories(),
    getPosts({
      limit: PAGE_SIZE,
      offset,
      search: q || undefined,
      dateStart: range?.start,
      dateEnd: range?.end,
    }),
  ]);

  // Carry active filters through pagination links.
  const pageQuery: Record<string, string> = {};
  if (q) pageQuery.q = q;
  if (date) pageQuery.date = date;

  const toolbar = filtering
    ? `${posts.length}${posts.length === PAGE_SIZE ? "+" : ""} result${posts.length === 1 ? "" : "s"}${q ? ` for “${q}”` : ""}${date ? ` on ${date}` : ""}`
    : "Latest";

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      {page === 1 && !filtering && (
        <section className="mb-8">
          <h1 className="text-display-small text-on-surface max-w-3xl text-balance">
            SEO &amp; digital marketing news, curated and summarized.
          </h1>
          <p className="mt-3 text-body-large text-on-surface-variant max-w-2xl">
            The latest headlines from dozens of trusted sources — categorized and condensed into
            quick TLDRs, updated throughout the day.
          </p>
        </section>
      )}

      <section className="mb-6">
        <FilterBar action="/" q={q} date={date} />
      </section>

      <section className="mb-8">
        <CategoryChips categories={categories} />
      </section>

      <Feed
        posts={posts}
        startIndex={offset}
        toolbarStart={toolbar}
        emptyLabel={
          filtering
            ? "No articles match those filters."
            : "No articles yet — add sources in the admin and run the ingest to populate the feed."
        }
      />

      <Pagination basePath="/" page={page} hasNext={posts.length === PAGE_SIZE} query={pageQuery} />
    </main>
  );
}
