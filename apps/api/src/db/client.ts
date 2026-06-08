import { PrismaClient } from "@prisma/client";

/**
 * Single Prisma client for the process. Log level is set explicitly (C5): never `query` (which
 * would echo bound params like emails into logs), regardless of future library default changes.
 */
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "production" ? ["error"] : ["warn", "error"],
});
