import { PrismaClient } from "@prisma/client";

// Uma instância por processo. Em dev o hot reload recriaria o cliente a cada
// salvamento e esgotaria as conexões do Postgres.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
