import { z } from 'zod';

const required = z.string().min(1);

const EnvSchema = z
  .object({
    DATABASE_URL: required,
    SUPABASE_URL: required,
    SUPABASE_SERVICE_ROLE_KEY: required,
    ELEVENLABS_API_KEY: required,
    FAL_KEY: required,
    VISION_MODEL: required.default('nebius/Qwen/Qwen3.8-27B'),
    NEBIUS_API_KEY: z.string().optional(),
    GOOGLE_AI_API_KEY: z.string().optional(),
    WEB_ORIGIN: required.default('http://localhost:3000'),
    PORT: z.coerce.number().int().positive().default(8787),
  })
  .superRefine((env, ctx) => {
    const provider = env.VISION_MODEL.startsWith('google/') ? 'GOOGLE_AI_API_KEY' : 'NEBIUS_API_KEY';
    if (!env[provider]) ctx.addIssue({ code: 'custom', path: [provider], message: 'required' });
  });

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (parsed.success) return parsed.data;
  const keys = [...new Set(parsed.error.issues.map((i) => String(i.path[0])))];
  throw new Error(`Invalid or missing environment variables: ${keys.join(', ')}`);
}
