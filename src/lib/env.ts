import { z } from "zod";

export const appEnvSchema = z.object({
  DATABASE_URL: z
    .string()
    .regex(/^postgres(ql)?:\/\//, "DATABASE_URL must use PostgreSQL"),
  APP_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().min(32),
  HMAC_KEY: z.string().min(32)
});

export type AppEnv = z.infer<typeof appEnvSchema>;

export function parseEnv(input: NodeJS.ProcessEnv = process.env): AppEnv {
  return appEnvSchema.parse(input);
}
