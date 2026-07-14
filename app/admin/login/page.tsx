import { login } from "@/app/admin/actions";
import { Button } from "@/components/md/Button";
import { Icon } from "@/components/md/Icon";

export const metadata = { title: "Admin sign-in", robots: { index: false } };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  return (
    <main className="min-h-dvh grid place-items-center bg-background px-4">
      <div className="w-full max-w-sm bg-surface-container-low rounded-xl shadow-e1 p-8">
        <div className="flex items-center gap-2 mb-6">
          <span className="grid place-items-center size-9 rounded-full bg-primary text-on-primary">
            <Icon name="hub" filled />
          </span>
          <span className="text-title-large font-medium">Optimixed Admin</span>
        </div>

        {error && (
          <p className="mb-4 text-body-small text-on-error-container bg-error-container rounded-sm px-3 py-2">
            Incorrect password.
          </p>
        )}

        <form action={login} className="flex flex-col gap-4">
          <input type="hidden" name="next" value={next ?? "/admin"} />
          <label className="flex flex-col gap-1 text-label-large text-on-surface-variant">
            Password
            <input
              type="password"
              name="password"
              required
              autoFocus
              className="h-12 rounded-xs border border-outline bg-surface px-3 text-body-large text-on-surface outline-none focus:border-primary focus:border-2"
            />
          </label>
          <Button type="submit" className="w-full">
            Sign in
          </Button>
        </form>
      </div>
    </main>
  );
}
