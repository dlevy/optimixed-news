import Link from "next/link";
import { getCategories, getPosts, getPostsCount } from "@/lib/queries";
import { FilterBar } from "@/components/site/FilterBar";
import { Feed } from "@/components/site/Feed";
import { Pagination } from "@/components/site/Pagination";
import { Chip } from "@/components/md/Chip";
import { Icon } from "@/components/md/Icon";
import { clsx } from "@/lib/clsx";

export const revalidate = 300; // ISR: refresh every 5 min

const PAGE_SIZE = 24;

const PERIODS = [
  { key: "today", label: "Today" },
  { key: "3d", label: "3 days" },
  { key: "7d", label: "Week" },
  { key: "30d", label: "Month" },
  { key: "90d", label: "90 days" },
  { key: "all", label: "All time" },
] as const;
const DEFAULT_WITHIN = "3d";

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
    case "3d":
      return days(3);
    case "7d":
      return days(7);
    case "30d":
      return days(30);
    case "90d":
      return days(90);
    case "all":
    default:
      return undefined;
  }
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    q?: string;
    within?: string;
    sort?: string;
    cat?: string | string[]; // from the checkbox form
    cats?: string; // comma-joined, from links/pagination
    roundup?: string;
    exclusive?: string;
  }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;
  const q = (sp.q ?? "").trim();
  const within = PERIODS.some((p) => p.key === sp.within) ? sp.within! : DEFAULT_WITHIN;
  const sort = sp.sort === "relevant" ? "relevant" : "latest";
  const inclRoundup = sp.roundup === "1";
  const exclusivesOnly = sp.exclusive === "1";

  const categories = await getCategories();
  const allSlugs = categories.map((c) => c.slug);
  const catBySlug = new Map(categories.map((c) => [c.slug, c.id]));

  // Which categories are checked. Default (no param) = all.
  const selected = sp.cat
    ? Array.isArray(sp.cat)
      ? sp.cat
      : [sp.cat]
    : sp.cats
      ? sp.cats.split(",").filter(Boolean)
      : null;
  const activeSlugs = selected ? selected.filter((s) => allSlugs.includes(s)) : allSlugs;
  const isSubset = selected !== null && activeSlugs.length > 0 && activeSlugs.length < allSlugs.length;
  const categoryIds = isSubset
    ? activeSlugs.map((s) => catBySlug.get(s)!).filter(Boolean)
    : undefined;
  const catsCsv = isSubset ? activeSlugs.join(",") : "";

  const filtering = Boolean(
    q || within !== DEFAULT_WITHIN || sort === "relevant" || isSubset || inclRoundup || exclusivesOnly,
  );

  const filters = {
    search: q || undefined,
    // Exclusives are rare by design — a date window would usually empty the feed.
    dateStart: exclusivesOnly ? undefined : withinStart(within),
    categoryIds,
    excludeRoundup: !inclRoundup,
    exclusivesOnly,
  };
  const [posts, total] = await Promise.all([
    getPosts({ ...filters, limit: PAGE_SIZE, offset, sort }),
    getPostsCount(filters),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const countLabel = `${total.toLocaleString()} article${total === 1 ? "" : "s"} · Page ${page} of ${totalPages}`;

  // Build hrefs / pagination that preserve every active filter.
  const hrefWith = (over: { within?: string; sort?: string; exclusive?: boolean }): string => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    const w = over.within ?? within;
    if (w && w !== DEFAULT_WITHIN) p.set("within", w);
    const s = over.sort ?? sort;
    if (s === "relevant") p.set("sort", s);
    if (catsCsv) p.set("cats", catsCsv);
    if (inclRoundup) p.set("roundup", "1");
    if (over.exclusive ?? exclusivesOnly) p.set("exclusive", "1");
    const str = p.toString();
    return str ? `/?${str}` : "/";
  };

  // Link that selects ONLY one category (preserving period/sort/search).
  const onlyHref = (slug: string): string => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (within !== DEFAULT_WITHIN) p.set("within", within);
    if (sort === "relevant") p.set("sort", sort);
    if (inclRoundup) p.set("roundup", "1");
    if (exclusivesOnly) p.set("exclusive", "1");
    p.set("cats", slug);
    return `/?${p.toString()}`;
  };

  const pageQuery: Record<string, string> = {};
  if (q) pageQuery.q = q;
  if (within !== DEFAULT_WITHIN) pageQuery.within = within;
  if (sort === "relevant") pageQuery.sort = sort;
  if (catsCsv) pageQuery.cats = catsCsv;
  if (inclRoundup) pageQuery.roundup = "1";
  if (exclusivesOnly) pageQuery.exclusive = "1";

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
        <FilterBar
          action="/"
          q={q}
          within={within !== DEFAULT_WITHIN ? within : ""}
          sort={sort}
          cats={catsCsv}
          roundup={inclRoundup}
          exclusive={exclusivesOnly}
        />
      </section>

      {/* Original reporting */}
      <section className="mb-4">
        <Link
          href={hrefWith({ exclusive: !exclusivesOnly })}
          className={clsx(
            "inline-flex items-center gap-2 h-9 px-4 rounded-full text-label-large border transition-colors",
            exclusivesOnly
              ? "bg-tertiary text-on-tertiary border-transparent shadow-e1"
              : "border-outline-variant text-on-surface-variant hover:bg-on-surface/8",
          )}
        >
          <Icon name="editor_choice" filled={exclusivesOnly} className="text-[18px]" />
          {exclusivesOnly ? "Showing Optimixed Exclusives" : "Optimixed Exclusives only"}
          {exclusivesOnly && <Icon name="close" className="text-[16px]" />}
        </Link>
      </section>

      {/* Period + sort */}
      <section className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className={clsx("flex flex-wrap items-center gap-2", exclusivesOnly && "opacity-[0.38] pointer-events-none")}>
          <span className="text-label-large text-on-surface-variant mr-1">Published:</span>
          {PERIODS.map((p) => (
            <Chip key={p.key || "all"} href={hrefWith({ within: p.key })} selected={within === p.key}>
              {p.label}
            </Chip>
          ))}
        </div>
        <div className="inline-flex shrink-0" role="group" aria-label="Sort">
          {SORTS.map((s, i) => (
            <Link
              key={s.key}
              href={hrefWith({ sort: s.key })}
              className={clsx(
                "inline-flex items-center h-8 px-3 text-label-large border border-outline transition-colors",
                i === 0 ? "rounded-l-full border-r-0" : "rounded-r-full",
                sort === s.key
                  ? "bg-secondary-container text-on-secondary-container"
                  : "text-on-surface-variant hover:bg-on-surface/8",
              )}
            >
              {s.label}
            </Link>
          ))}
        </div>
      </section>

      {/* Category checkbox filter */}
      <section className="mb-8">
        <details className="group rounded-lg border border-outline-variant bg-surface-container-low">
          <summary className="cursor-pointer list-none px-4 py-3 flex items-center gap-2 text-label-large text-on-surface">
            <Icon name="tune" className="text-[20px] text-on-surface-variant" />
            Filter categories
            {(isSubset || inclRoundup) && (
              <span className="ml-1 text-label-small px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container">
                {isSubset ? `${activeSlugs.length}/${allSlugs.length}` : "custom"}
              </span>
            )}
            <Icon name="expand_more" className="ml-auto text-[20px] text-on-surface-variant group-open:rotate-180 transition-transform" />
          </summary>
          <form action="/" className="px-4 pb-4 pt-1 flex flex-col gap-4">
            {q && <input type="hidden" name="q" value={q} />}
            {within !== DEFAULT_WITHIN && <input type="hidden" name="within" value={within} />}
            {sort === "relevant" && <input type="hidden" name="sort" value={sort} />}
            {exclusivesOnly && <input type="hidden" name="exclusive" value="1" />}

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((c) => (
                <div key={c.id} className="flex items-center gap-2 group/cat">
                  <label className="flex items-center gap-2 flex-1 text-body-medium text-on-surface">
                    <input
                      type="checkbox"
                      name="cat"
                      value={c.slug}
                      defaultChecked={activeSlugs.includes(c.slug)}
                      className="size-4 accent-[var(--md-sys-color-primary)]"
                    />
                    {c.name}
                  </label>
                  <Link
                    href={onlyHref(c.slug)}
                    className="shrink-0 text-label-small text-primary opacity-0 group-hover/cat:opacity-100 focus:opacity-100 hover:underline"
                  >
                    only
                  </Link>
                </div>
              ))}
            </div>

            <label className="flex items-center gap-2 text-body-medium text-on-surface border-t border-outline-variant pt-3">
              <input
                type="checkbox"
                name="roundup"
                value="1"
                defaultChecked={inclRoundup}
                className="size-4 accent-[var(--md-sys-color-primary)]"
              />
              Include roundups <span className="text-on-surface-variant text-body-small">(link digests / recaps — hidden by default)</span>
            </label>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="h-10 px-5 rounded-full bg-primary text-on-primary text-label-large hover:shadow-e1"
              >
                Apply
              </button>
              <Link
                href="/"
                className="h-10 px-4 inline-flex items-center rounded-full text-label-large text-primary hover:bg-primary/8"
              >
                Reset
              </Link>
            </div>
          </form>
        </details>
      </section>

      <Feed
        posts={posts}
        startIndex={offset}
        toolbarStart={countLabel}
        emptyLabel={
          filtering
            ? "No articles match those filters."
            : "No articles yet — add sources in the admin and run the ingest to populate the feed."
        }
      />

      <Pagination basePath="/" page={page} totalPages={totalPages} query={pageQuery} />
    </main>
  );
}
