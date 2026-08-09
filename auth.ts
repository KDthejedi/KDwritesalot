/**
 * Auth.js (NextAuth v5) configuration.
 *
 * Google is the production sign-in. A dev-only Credentials provider (gated by
 * ENABLE_DEV_LOGIN and never enabled in production) lets automated tests and
 * local development log in without OAuth.
 *
 * Sessions use the JWT strategy for two reasons: the Credentials provider
 * requires it, and it keeps `auth()` free of database access so it can run in
 * lightweight contexts. The Prisma adapter still persists users/accounts on
 * OAuth sign-in; the JWT simply carries the user id.
 */

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

const devLoginEnabled =
  process.env.ENABLE_DEV_LOGIN === "true" && process.env.NODE_ENV !== "production";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  // Trust the deployment host (needed when not running behind Vercel's
  // auto-detected host, e.g. self-hosted or local). Configure AUTH_URL in prod.
  trustHost: true,
  pages: { signIn: "/signin" },
  providers: [
    Google,
    ...(devLoginEnabled
      ? [
          Credentials({
            id: "dev",
            name: "Dev Login",
            credentials: { email: {}, name: {} },
            authorize: async (creds) => {
              const email = String(creds?.email ?? "").trim().toLowerCase();
              if (!email) return null;
              const name = String(creds?.name ?? "").trim() || email.split("@")[0];
              const user = await prisma.user.upsert({
                where: { email },
                update: { name },
                create: { email, name },
              });
              return { id: user.id, email: user.email, name: user.name };
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && typeof token.id === "string") {
        session.user.id = token.id;
      }
      return session;
    },
  },
});
