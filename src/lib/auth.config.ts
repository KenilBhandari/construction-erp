import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Edge-safe auth config — NO database imports (mongoose cannot run in the
 * Edge Runtime, and middleware runs there). Used by middleware.ts, which
 * only decodes the session JWT and never touches MongoDB.
 *
 * The full server config in ./auth.ts spreads this and adds the DB-backed
 * callbacks (user sync, dbId lookup).
 */
export const authConfig: NextAuthConfig = {
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    // Route monitor — runs in middleware (Edge-safe: no DB access here,
    // only the decoded JWT in `auth`).
    // - Signed-in users never see / or /login: bounce to /dashboard.
    // - Signed-out users cannot reach /dashboard/*: bounce to /login.
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = request.nextUrl;

      if (isLoggedIn && (pathname === "/" || pathname === "/login")) {
        return Response.redirect(new URL("/dashboard", request.url));
      }
      if (!isLoggedIn && pathname.startsWith("/dashboard")) {
        return Response.redirect(new URL("/login", request.url));
      }
      return true;
    },
  },
  providers: [
    // Auth.js v5 auto-reads AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET.
    // Passed explicitly too so the legacy GOOGLE_CLIENT_ID names keep working.
    Google({
      clientId: process.env.AUTH_GOOGLE_ID ?? process.env.GOOGLE_CLIENT_ID,
      clientSecret:
        process.env.AUTH_GOOGLE_SECRET ?? process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
};
