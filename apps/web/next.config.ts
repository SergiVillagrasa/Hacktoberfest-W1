import path from 'node:path';
import type { NextConfig } from 'next';

const basePath = process.env.BASE_PATH ?? '';

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@snaphunt/contracts'],
  turbopack: { root: path.join(import.meta.dirname, '../..') },
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  ...(basePath
    ? {
        basePath,
        async redirects() {
          return [{ source: '/', destination: basePath, permanent: false, basePath: false }];
        },
      }
    : {}),
};

export default config;
