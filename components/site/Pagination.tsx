import Link from "next/link";
import { Icon } from "@/components/md/Icon";
import { clsx } from "@/lib/clsx";

/** Simple prev/next pager. `hasNext` is derived by the caller (full page fetched). */
export function Pagination({
  basePath,
  page,
  hasNext,
  query = {},
}: {
  basePath: string;
  page: number;
  hasNext: boolean;
  query?: Record<string, string>;
}) {
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
      <span className="text-body-small text-on-surface-variant">Page {page}</span>
      <Link
        href={href(page + 1)}
        className={clsx(linkCls, !hasNext && disabledCls)}
        aria-disabled={!hasNext}
      >
        Older
        <Icon name="chevron_right" className="text-[20px]" />
      </Link>
    </nav>
  );
}
