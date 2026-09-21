import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { connectDB } from "./mongodb";
import { User } from "@/models/User";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    // Auth.js v5 auto-reads AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET.
    // Passed explicitly too so the legacy GOOGLE_CLIENT_ID names keep working.
    Google({
      clientId: process.env.AUTH_GOOGLE_ID ?? process.env.GOOGLE_CLIENT_ID,
      clientSecret:
        process.env.AUTH_GOOGLE_SECRET ?? process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    // Sync Google profile to MongoDB. Allow sign-in even if DB is
    // unreachable (dev without MONGODB_URI) so UI work isn't blocked.
    async signIn({ user }) {
      if (!user.email) return false;
      try {
        await connectDB();
        await User.findOneAndUpdate(
          { email: user.email },
          {
            googleId: user.id ?? user.email,
            email: user.email,
            name: user.name ?? user.email,
            image: user.image ?? null,
          },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        );
      } catch (err) {
        console.warn("[auth] User sync skipped:", (err as Error).message);
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user?.email) {
        try {
          await connectDB();
          const dbUser = await User.findOne({ email: user.email })
            .select("_id")
            .lean();
          if (dbUser) token.dbId = String(dbUser._id);
        } catch {
          // DB optional in dev — fall back to provider sub.
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id =
          (token.dbId as string | undefined) ?? token.sub ?? "";
      }
      return session;
    },
  },
});
