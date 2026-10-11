import { describe, expect, test } from 'vitest';
import { loadEnv } from '../src/env';

describe('loadEnv', () => {
  test('applies defaults', () => {
    expect(loadEnv({ DATABASE_URL: 'postgresql://x' })).toMatchObject({ WEB_ORIGIN: 'http://localhost:3000', PORT: 8787 });
  });
  test('fails fast naming only the missing key, never its value', () => {
    expect(() => loadEnv({})).toThrow('DATABASE_URL');
    expect(() => loadEnv({ DATABASE_URL: '', WEB_ORIGIN: 'secret-value' })).not.toThrow(/secret-value/);
  });
});
