import { Chip } from "@/components/md/Chip";
import type { Category } from "@/lib/types";

export function CategoryChips({
  categories,
  activeSlug,
}: {
  categories: Category[];
  activeSlug?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Chip href="/" selected={!activeSlug}>
        All
      </Chip>
      {categories.map((c) => (
        <Chip key={c.id} href={`/category/${c.slug}`} selected={c.slug === activeSlug}>
          {c.name}
        </Chip>
      ))}
    </div>
  );
}
