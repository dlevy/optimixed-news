import type { ReactNode } from "react";
import { clsx } from "@/lib/clsx";

type Variant = "elevated" | "filled" | "outlined";

const variants: Record<Variant, string> = {
  elevated: "bg-surface-container-low shadow-e1",
  filled: "bg-surface-container-highest",
  outlined: "bg-surface border border-outline-variant",
};

export function Card({
  variant = "elevated",
  className,
  children,
}: {
  variant?: Variant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={clsx("rounded-lg overflow-hidden", variants[variant], className)}>
      {children}
    </div>
  );
}
