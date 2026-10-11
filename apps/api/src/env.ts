import { z } from 'zod';

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  WEB_ORIGIN: z.string().min(1).default('http://localhost:3000'),
  PORT: z.coerce.number().int().positive().default(8787),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (parsed.success) return parsed.data;
  const keys = [...new Set(parsed.error.issues.map((i) => String(i.path[0])))];
  throw new Error(`Invalid or missing environment variables: ${keys.join(', ')}`);
}
