import Link from "next/link";
import type { ReactNode } from "react";
import { clsx } from "@/lib/clsx";

type ChipProps = {
  children: ReactNode;
  href?: string;
  selected?: boolean;
  className?: string;
};

/** MD3 assist/filter chip. Renders as a link when `href` is provided. */
export function Chip({ children, href, selected = false, className }: ChipProps) {
  const cn = clsx(
    "inline-flex items-center gap-1.5 h-8 px-3 rounded-sm text-label-large border transition-colors",
    selected
      ? "bg-secondary-container text-on-secondary-container border-transparent"
      : "bg-surface text-on-surface-variant border-outline-variant hover:bg-on-surface/8",
    className,
  );
  return href ? (
    <Link href={href} className={cn}>
      {children}
    </Link>
  ) : (
    <span className={cn}>{children}</span>
  );
}
