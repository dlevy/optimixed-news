import { getCategories, getPosts } from "@/lib/queries";
import { CategoryChips } from "@/components/site/CategoryChips";
import { FilterBar } from "@/components/site/FilterBar";
import { Feed } from "@/components/site/Feed";
import { Pagination } from "@/components/site/Pagination";
import { Chip } from "@/components/md/Chip";
import { clsx } from "@/lib/clsx";

export const revalidate = 300; // ISR: refresh every 5 min

const PAGE_SIZE = 24;

const PERIODS = [
  { key: "", label: "All time" },
  { key: "today", label: "Today" },
  { key: "2d", label: "2 days" },
  { key: "7d", label: "Week" },
  { key: "30d", label: "Month" },
  { key: "90d", label: "90 days" },
] as const;

const SORTS = [
  { key: "latest", label: "Latest" },
  { key: "relevant", label: "Most relevant" },
] as const;

function withinStart(within: string): string | undefined {
  const now = Date.now();
  const days = (n: number) => new Date(now - n * 86_400_000).toISOString();
  switch (within) {
    case "today": {
      const d = new Date();
      d.setUTCHours(0, 0, 0, 0);
      return d.toISOString();
    }
    case "2d":
      return days(2);
    case "7d":
      return days(7);
    case "30d":
      return days(30);
    case "90d":
      return days(90);
    default:
      return undefined;
  }
}

function hrefWith(params: { q?: string; within?: string; sort?: string }): string {
  const p = new URLSearchParams();
  if (params.q) p.set("q", params.q);
  if (params.within) p.set("within", params.within);
  if (params.sort && params.sort !== "latest") p.set("sort", params.sort);
  const s = p.toString();
  return s ? `/?${s}` : "/";
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; within?: string; sort?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;
  const q = (sp.q ?? "").trim();
  const within = PERIODS.some((p) => p.key === sp.within) ? (sp.within ?? "") : "";
  const sort = sp.sort === "relevant" ? "relevant" : "latest";
  const filtering = Boolean(q || within || sort === "relevant");

  const [categories, posts] = await Promise.all([
    getCategories(),
    getPosts({
      limit: PAGE_SIZE,
      offset,
      search: q || undefined,
      dateStart: withinStart(within),
      sort,
    }),
  ]);

  const pageQuery: Record<string, string> = {};
  if (q) pageQuery.q = q;
  if (within) pageQuery.within = within;
  if (sort === "relevant") pageQuery.sort = sort;

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
        <FilterBar action="/" q={q} within={within} sort={sort} />
      </section>

      {/* Period + sort controls */}
      <section className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-label-large text-on-surface-variant mr-1">Published:</span>
          {PERIODS.map((p) => (
            <Chip
              key={p.key || "all"}
              href={hrefWith({ q, within: p.key, sort })}
              selected={within === p.key}
            >
              {p.label}
            </Chip>
          ))}
        </div>
        <div className="inline-flex shrink-0" role="group" aria-label="Sort">
          {SORTS.map((s, i) => (
            <a
              key={s.key}
              href={hrefWith({ q, within, sort: s.key })}
              className={clsx(
                "inline-flex items-center h-8 px-3 text-label-large border border-outline transition-colors",
                i === 0 ? "rounded-l-full border-r-0" : "rounded-r-full",
                sort === s.key
                  ? "bg-secondary-container text-on-secondary-container"
                  : "text-on-surface-variant hover:bg-on-surface/8",
              )}
            >
              {s.label}
            </a>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <CategoryChips categories={categories} />
      </section>

      <Feed
        posts={posts}
        startIndex={offset}
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
