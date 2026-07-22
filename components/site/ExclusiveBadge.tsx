import { clsx } from "@/lib/clsx";
import { Icon } from "@/components/md/Icon";

/**
 * Marks original Optimixed reporting (origin='internal') — the articles that
 * are researched and written here rather than aggregated from a feed.
 */
export function ExclusiveBadge({
  size = "medium",
  className,
}: {
  size?: "small" | "medium" | "large";
  className?: string;
}) {
  const dims = {
    small: "h-6 px-2 text-label-small gap-1",
    medium: "h-7 px-2.5 text-label-medium gap-1",
    large: "h-8 px-3 text-label-large gap-1.5",
  }[size];
  const icon = { small: "text-[14px]", medium: "text-[16px]", large: "text-[18px]" }[size];

  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full font-medium tracking-wide uppercase",
        "bg-tertiary text-on-tertiary shadow-e1",
        dims,
        className,
      )}
    >
      <Icon name="editor_choice" filled className={icon} />
      Optimixed Exclusive
    </span>
  );
}
