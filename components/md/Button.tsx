import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { clsx } from "@/lib/clsx";

type Variant = "filled" | "tonal" | "outlined" | "text" | "elevated";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full px-6 h-10 " +
  "text-label-large font-medium transition-shadow transition-colors " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary " +
  "disabled:pointer-events-none disabled:opacity-[0.38] select-none";

const variants: Record<Variant, string> = {
  filled: "bg-primary text-on-primary hover:shadow-e1",
  tonal: "bg-secondary-container text-on-secondary-container hover:shadow-e1",
  elevated: "bg-surface-container-low text-primary shadow-e1 hover:shadow-e2",
  outlined: "border border-outline text-primary hover:bg-primary/8",
  text: "text-primary px-3 hover:bg-primary/8",
};

type ButtonProps = {
  variant?: Variant;
  children: ReactNode;
  className?: string;
} & (
  | ({ href: string } & Omit<ComponentProps<typeof Link>, "href" | "className">)
  | ({ href?: undefined } & ComponentProps<"button">)
);

export function Button({ variant = "filled", children, className, ...rest }: ButtonProps) {
  const cn = clsx(base, variants[variant], className);
  if ("href" in rest && rest.href) {
    const { href, ...linkRest } = rest;
    return (
      <Link href={href} className={cn} {...linkRest}>
        {children}
      </Link>
    );
  }
  return (
    <button className={cn} {...(rest as ComponentProps<"button">)}>
      {children}
    </button>
  );
}
