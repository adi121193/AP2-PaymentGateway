import { z } from "zod";

export const EnvSchema = z.object({
  // Application Environment
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),

  // Database Configuration
  DATABASE_URL: z
    .string()
    .url()
    .refine(
      (url) => url.startsWith("postgresql://") || url.startsWith("postgres://"),
      {
        message: "DATABASE_URL must be a valid PostgreSQL connection string",
      }
    ),

  // Stripe Configuration (Test Mode Only)
  STRIPE_SECRET_KEY: z
    .string()
    .min(1)
    .refine((key) => key.startsWith("sk_test_"), {
      message: "STRIPE_SECRET_KEY must be a test key (sk_test_)",
    }),
  STRIPE_WEBHOOK_SECRET: z
    .string()
    .min(1)
    .refine((secret) => secret.startsWith("whsec_"), {
      message: "STRIPE_WEBHOOK_SECRET must start with 'whsec_'",
    }),

  // Cryptographic Keys
  MANDATE_SIGN_KEY: z
    .string()
    .min(64, "MANDATE_SIGN_KEY must be at least 64 characters (Ed25519 private key)"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),

  // CORS Configuration
  ALLOWED_ORIGINS: z
    .string()
    .default("http://localhost:3000")
    .transform((origins) => origins.split(",").map((o) => o.trim())),

  // Optional: x402 Configuration
  X402_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  X402_MAX_AMOUNT: z.coerce.number().int().positive().default(200),

  // Optional: Logging and Monitoring
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
  ENABLE_REQUEST_LOGGING: z
    .string()
    .default("true")
    .transform((val) => val === "true"),
});

export type Env = z.infer<typeof EnvSchema>;

let cachedEnv: Env | null = null;

export function loadEnv(): Env {
  if (cachedEnv) {
    return cachedEnv;
  }

  try {
    cachedEnv = EnvSchema.parse(process.env);
    return cachedEnv;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Environment validation failed:");
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join(".")}: ${err.message}`);
      });
      throw new Error("Invalid environment configuration. Check the errors above.");
    }
    throw error;
  }
}

export function getEnv(): Env {
  if (!cachedEnv) {
    throw new Error("Environment not loaded. Call loadEnv() first.");
  }
  return cachedEnv;
}
