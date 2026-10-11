import { expect, test } from 'bun:test';

test('@snaphunt/core imports', async () => {
  expect(await import('@snaphunt/core')).toBeDefined();
});
