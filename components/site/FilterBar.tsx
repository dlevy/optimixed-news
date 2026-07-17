import { Icon } from "@/components/md/Icon";

/**
 * SSR search box. Native GET form — works without JS. Preserves the active
 * period/sort via hidden fields so a search keeps the current view.
 */
export function FilterBar({
  action = "/",
  q = "",
  within = "",
  sort = "",
}: {
  action?: string;
  q?: string;
  within?: string;
  sort?: string;
}) {
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      {within && <input type="hidden" name="within" value={within} />}
      {sort && <input type="hidden" name="sort" value={sort} />}
      <div className="flex items-center gap-2 h-12 rounded-full bg-surface-container-high px-4 flex-1 min-w-[220px] focus-within:outline-2 focus-within:outline-primary">
        <Icon name="search" className="text-on-surface-variant" />
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search articles…"
          className="flex-1 bg-transparent outline-none text-body-large text-on-surface min-w-0"
        />
      </div>
      <button
        type="submit"
        className="h-12 px-6 rounded-full bg-primary text-on-primary text-label-large hover:shadow-e1"
      >
        Search
      </button>
      {q && (
        <a
          href={action}
          className="h-12 px-4 inline-flex items-center gap-1 rounded-full text-label-large text-primary hover:bg-primary/8"
        >
          <Icon name="close" className="text-[18px]" />
          Clear
        </a>
      )}
    </form>
  );
}
