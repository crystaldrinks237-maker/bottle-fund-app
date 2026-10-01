import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { Pool as PgPool, types as pgTypes } from 'pg';
import ws from 'ws';

// Neon hosts use the serverless (WebSocket) driver so real interactive transactions
// (BEGIN … SELECT … FOR UPDATE … COMMIT) work on Vercel. Anything else (local Postgres) uses node-postgres.
export type Tx = { q: <T = any>(text: string, params?: any[]) => Promise<T[]> };

// Postgres DATE (OID 1082) → keep as the plain 'YYYY-MM-DD' string. The default JS Date conversion depends on the
// server's timezone and can shift a day (or a whole month label) on a non-UTC machine.
const typeOpts = { getTypeParser: (oid: number, fmt?: any) => (oid === 1082 ? (v: string) => v : (pgTypes as any).getTypeParser(oid, fmt)) };

const g = globalThis as any;
function getPool(): any {
  if (g.__cdPool) return g.__cdPool;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not configured');
  if (/neon\.tech/.test(url)) {
    neonConfig.webSocketConstructor = ws as any;
    g.__cdPool = new NeonPool({ connectionString: url, max: 5, types: typeOpts } as any);
  } else {
    g.__cdPool = new PgPool({ connectionString: url, max: 5, types: typeOpts } as any);
  }
  return g.__cdPool;
}

export async function query<T = any>(text: string, params: any[] = []): Promise<T[]> {
  const r = await getPool().query(text, params);
  return r.rows as T[];
}

export async function tx<T>(fn: (t: Tx) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  const t: Tx = { q: async (text, params = []) => (await client.query(text, params)).rows };
  try {
    await client.query('BEGIN');
    const out = await fn(t);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    throw e;
  } finally {
    client.release();
  }
}
export const pool: Tx = { q: query };
