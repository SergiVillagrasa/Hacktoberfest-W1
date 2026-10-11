import path from 'node:path';
import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@snaphunt/contracts'],
  turbopack: { root: path.join(import.meta.dirname, '../..') },
};

export default config;
