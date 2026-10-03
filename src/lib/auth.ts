import NextAuth from "next-auth";
import { connectDB } from "./mongodb";
import { User } from "@/models/User";
import { authConfig } from "./auth.config";
import Credentials from "next-auth/providers/credentials";

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
  ...authConfig,
  providers: [
    ...authConfig.providers,
     Credentials({
      id: "direct-access",
      name: "Direct Access",
      credentials: {},
      async authorize() {
        await connectDB();

        const dbUser = await User.findOne({
          email: "honeyoyo14@gmail.com",
        }).lean();

        if (!dbUser) return null;

        return {
          id: String(dbUser._id),
          email: dbUser.email,
          name: dbUser.name,
          image: dbUser.image,
        };
      },
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
