import Link from "next/link";
import { Icon } from "@/components/md/Icon";
import { clsx } from "@/lib/clsx";

/** Prev/next pager. Pass `totalPages` for an exact "Page X of Y" + last-page
 *  detection, or `hasNext` when only "is there another page" is known. */
export function Pagination({
  basePath,
  page,
  hasNext,
  totalPages,
  query = {},
}: {
  basePath: string;
  page: number;
  hasNext?: boolean;
  totalPages?: number;
  query?: Record<string, string>;
}) {
  const canNext = totalPages != null ? page < totalPages : Boolean(hasNext);
  const href = (p: number) => {
    const params = new URLSearchParams({ ...query });
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  const linkCls =
    "inline-flex items-center gap-1 h-10 px-4 rounded-full text-label-large border border-outline text-primary hover:bg-primary/8";
  const disabledCls = "opacity-[0.38] pointer-events-none";

  return (
    <nav className="flex items-center justify-between gap-4 pt-4" aria-label="Pagination">
      <Link
        href={href(page - 1)}
        className={clsx(linkCls, page <= 1 && disabledCls)}
        aria-disabled={page <= 1}
      >
        <Icon name="chevron_left" className="text-[20px]" />
        Newer
      </Link>
      <span className="text-body-small text-on-surface-variant">
        {totalPages != null ? `Page ${page} of ${totalPages}` : `Page ${page}`}
      </span>
      <Link
        href={href(page + 1)}
        className={clsx(linkCls, !canNext && disabledCls)}
        aria-disabled={!canNext}
      >
        Older
        <Icon name="chevron_right" className="text-[20px]" />
      </Link>
    </nav>
  );
}
