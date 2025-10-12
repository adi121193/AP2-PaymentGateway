import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Use process.env directly since getEnv() requires loadEnv() first
const NODE_ENV = process.env.NODE_ENV || "development";

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    console.log("Database connected successfully");
  } catch (error) {
    console.error("Failed to connect to database:", error);
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  console.log("Database disconnected");
}
