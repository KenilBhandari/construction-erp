import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { signInWithGoogle } from "./signin-action";

/**
 * Google sign-in embedded directly in the landing page, so visitors never
 * leave the marketing UI for a separate login screen. Same server action
 * pattern as src/app/login/page.tsx (kept as a fallback route).
 */
export function LandingSignIn({ className }: { className?: string }) {
  return (
    <form className={cn("min-w-0", className)} action={signInWithGoogle}>
      <Button
        type="submit"
        className="w-full px-5 py-3 text-[15px] sm:w-auto"
      >
        Continue with Google
      </Button>
    </form>
  );
}
