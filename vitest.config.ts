import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./apps/web/src', import.meta.url)) } },
  test: { include: ['packages/*/test/**/*.test.ts', 'apps/*/test/**/*.test.ts'] },
});
