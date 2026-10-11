import { drizzle } from 'drizzle-orm/postgres-js';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import postgres from 'postgres';
import * as schema from './schema';

export type Db = PgDatabase<any, typeof schema>;

export function createDb(url: string): Db {
  return drizzle(postgres(url, { prepare: false }), { schema });
}
