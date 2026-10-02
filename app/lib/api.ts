import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { MoneyError } from './money';

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) { super(message); }
}
export const bad = (m: string, code?: string) => new ApiError(400, m, code);
export const notFound = (m = 'Not found') => new ApiError(404, m);
export const conflict = (m: string, code?: string) => new ApiError(409, m, code);

type H = (req: Request, ctx: any) => Promise<any>;
/** Wraps a route handler: JSON-encodes results and maps known errors to clean HTTP responses. */
export function handler(fn: H, opts: { allowWhileViewing?: boolean } = {}) {
  return async (req: Request, ctx: any) => {
    try {
      // "View as user" is strictly read-only: while an admin is looking at the app as someone else, nothing can be changed.
      if (req.method !== 'GET' && req.method !== 'HEAD' && !opts.allowWhileViewing && (req.headers.get('cookie') || '').includes('cd_view_as=')) {
        const { isViewingAs } = await import('./session');
        if (await isViewingAs()) throw new ApiError(403, 'Read-only: you are viewing this account as an administrator. Exit view mode to make changes.', 'VIEW_ONLY');
      }
      const out = await fn(req, ctx);
      return out instanceof Response ? out : NextResponse.json(out ?? { ok: true }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (e: any) {
      if (e instanceof ApiError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
      if (e instanceof MoneyError) return NextResponse.json({ error: e.message }, { status: 400 });
      if (e instanceof ZodError) {
        const i = e.issues[0];
        return NextResponse.json({ error: `${i.path.join('.') || 'input'}: ${i.message}` }, { status: 400 });
      }
      if (e?.code === '23505') return NextResponse.json({ error: 'That record already exists.' }, { status: 409 });
      if (e?.code === '23514') return NextResponse.json({ error: 'That change violates a data-integrity rule.' }, { status: 409 });
      if (e?.code === '23503') return NextResponse.json({ error: 'A referenced record does not exist.' }, { status: 400 });
      console.error('[api]', req.method, new URL(req.url).pathname, e);
      return NextResponse.json({ error: 'Something went wrong on our side. Please try again.' }, { status: 500 });
    }
  };
}

export async function readJson(req: Request): Promise<any> {
  try { return await req.json(); } catch { throw bad('Request body must be valid JSON'); }
}

export function pageParams(url: URL, defaultSize = 20) {
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
  const size = Math.min(100, Math.max(1, parseInt(url.searchParams.get('size') || String(defaultSize), 10) || defaultSize));
  return { page, size, offset: (page - 1) * size };
}
export function sortParam(url: URL, allowed: Record<string, string>, def: string) {
  const raw = url.searchParams.get('sort') || def;
  const desc = raw.startsWith('-');
  const col = allowed[desc ? raw.slice(1) : raw] ?? allowed[def.replace(/^-/, '')];
  return `${col} ${desc ? 'DESC' : 'ASC'}`;
}
export const idParam = (v: string) => { const n = parseInt(v, 10); if (!Number.isInteger(n) || n <= 0) throw notFound(); return n; };

/** Small dynamic WHERE builder with positional params. */
export class Where {
  parts: string[] = []; params: any[] = [];
  add(sql: string, ...vals: any[]) {
    let s = sql; for (const v of vals) { this.params.push(v); s = s.replace('?', `$${this.params.length}`); }
    this.parts.push(s); return this;
  }
  get sql() { return this.parts.length ? 'WHERE ' + this.parts.join(' AND ') : ''; }
  next(v: any) { this.params.push(v); return `$${this.params.length}`; }
}
export const likeTerm = (s: string) => `%${s.replace(/[\\%_]/g, m => '\\' + m)}%`;
