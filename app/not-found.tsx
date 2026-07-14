import { Button } from "@/components/md/Button";
import { Icon } from "@/components/md/Icon";

export default function NotFound() {
  return (
    <main className="min-h-dvh grid place-items-center px-4 text-center">
      <div className="flex flex-col items-center gap-4">
        <span className="grid place-items-center size-16 rounded-full bg-surface-container-high text-on-surface-variant">
          <Icon name="search_off" className="text-[32px]" />
        </span>
        <h1 className="text-headline-medium text-on-surface">Page not found</h1>
        <p className="text-body-large text-on-surface-variant max-w-md">
          The page you’re looking for doesn’t exist or may have moved.
        </p>
        <Button href="/">
          <Icon name="home" className="text-[18px]" />
          Back to Optimixed
        </Button>
      </div>
    </main>
  );
}
