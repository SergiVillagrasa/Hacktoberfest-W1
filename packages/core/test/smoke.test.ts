import { expect, test } from 'vitest';

test('@snaphunt/core imports', async () => {
  expect(await import('@snaphunt/core')).toBeDefined();
});
