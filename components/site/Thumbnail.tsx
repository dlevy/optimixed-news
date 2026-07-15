import { Icon } from "@/components/md/Icon";
import { clsx } from "@/lib/clsx";

/**
 * Renders a post thumbnail. When no stored image exists, shows a consistent
 * themed MD3 placeholder so every tile has a uniform thumbnail block.
 * Pass sizing/rounding via `className` (e.g. "size-20 rounded-lg").
 */
export function Thumbnail({
  src,
  className,
  iconClassName = "text-[28px]",
}: {
  src: string | null;
  className?: string;
  iconClassName?: string;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        loading="lazy"
        className={clsx("object-cover bg-surface-container-high", className)}
      />
    );
  }
  return (
    <div
      className={clsx(
        "grid place-items-center bg-secondary-container text-on-secondary-container",
        className,
      )}
      aria-hidden="true"
    >
      <Icon name="newspaper" filled className={iconClassName} />
    </div>
  );
}
