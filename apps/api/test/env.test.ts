import { describe, expect, test } from 'vitest';
import { loadEnv } from '../src/env';

const base = { DATABASE_URL: 'postgresql://x', SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'k', ELEVENLABS_API_KEY: 'k', FAL_KEY: 'k', NEBIUS_API_KEY: 'k' };

describe('loadEnv', () => {
  test('applies defaults', () => {
    expect(loadEnv(base)).toMatchObject({ WEB_ORIGIN: 'http://localhost:3000', PORT: 8787, VISION_MODEL: 'nebius/Qwen/Qwen3.8-27B' });
  });
  test('fails fast naming only the missing key, never its value', () => {
    expect(() => loadEnv({})).toThrow('DATABASE_URL');
    expect(() => loadEnv({ DATABASE_URL: '', WEB_ORIGIN: 'secret-value' })).not.toThrow(/secret-value/);
  });
  test('requires the key of the selected vision provider', () => {
    const { NEBIUS_API_KEY: _omit, ...rest } = base;
    expect(() => loadEnv(rest)).toThrow('NEBIUS_API_KEY');
    expect(() => loadEnv({ ...rest, VISION_MODEL: 'google/gemma-4-31b-it' })).toThrow('GOOGLE_AI_API_KEY');
    expect(loadEnv({ ...rest, VISION_MODEL: 'google/gemma-4-31b-it', GOOGLE_AI_API_KEY: 'k' }).VISION_MODEL).toBe('google/gemma-4-31b-it');
  });
});
