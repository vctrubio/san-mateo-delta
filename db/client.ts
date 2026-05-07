import { Pool } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. See .env.local.example.');
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export type SqlParam = string | number | boolean | null | Date | Buffer | object;

export async function sql<T = Record<string, unknown>>(
  text: string,
  params: SqlParam[] = [],
): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows as T[];
}
