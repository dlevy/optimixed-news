import { clsx } from "@/lib/clsx";

type IconProps = {
  name: string;
  className?: string;
  filled?: boolean;
  /** optical size / weight tuning via font-variation-settings */
  weight?: number;
};

/** Material Symbols (Outlined) icon. Pass a symbol name, e.g. "search". */
export function Icon({ name, className, filled = false, weight = 400 }: IconProps) {
  return (
    <span
      className={clsx("material-symbols-outlined select-none", className)}
      style={{ fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' ${weight}` }}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}
