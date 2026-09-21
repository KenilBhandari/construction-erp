import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="flex flex-1 items-center justify-center bg-background px-6 py-16">
      <main className="w-full max-w-sm border border-border bg-surface p-8 rounded-lg">
        <p className="text-sm font-medium text-text-muted">Construction ERP</p>
        <h1 className="mt-2 text-2xl font-semibold text-text">Sign in</h1>
        <p className="mt-2 text-sm leading-6 text-text-muted">
          Use your Google account to access projects, labour, attendance and
          accounts.
        </p>
        <form
          className="mt-6"
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/dashboard" });
          }}
        >
          <Button type="submit" className="w-full">
            Continue with Google
          </Button>
        </form>
        <p className="mt-4 text-xs leading-5 text-text-muted">
          V1 supports Google login only. New users are created automatically on
          first sign-in.
        </p>
      </main>
    </div>
  );
}
