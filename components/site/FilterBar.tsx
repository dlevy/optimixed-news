import { Icon } from "@/components/md/Icon";

/**
 * SSR search + date filter. Native GET form — works without JS and keeps the
 * result set server-rendered (good for SEO). Submits ?q= and ?date= to `action`.
 */
export function FilterBar({
  action = "/",
  q = "",
  date = "",
}: {
  action?: string;
  q?: string;
  date?: string;
}) {
  const hasFilters = Boolean(q || date);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
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

      <label className="flex items-center gap-2 h-12 rounded-full bg-surface-container-high px-4">
        <Icon name="calendar_today" className="text-on-surface-variant text-[20px]" />
        <input
          type="date"
          name="date"
          defaultValue={date}
          aria-label="Filter by date"
          className="bg-transparent outline-none text-body-medium text-on-surface"
        />
      </label>

      <button
        type="submit"
        className="h-12 px-6 rounded-full bg-primary text-on-primary text-label-large hover:shadow-e1"
      >
        Apply
      </button>

      {hasFilters && (
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
