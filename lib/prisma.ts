/**
 * Prisma client singleton.
 *
 * In development Next.js reloads modules frequently; without a global cache each
 * reload would open a new pool of database connections and eventually exhaust
 * the database. We stash one client on globalThis and reuse it.
 */

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
