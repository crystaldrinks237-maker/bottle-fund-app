'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

export class ApiFail extends Error { constructor(message: string, public status: number, public code?: string) { super(message); } }

export async function api<T = any>(url: string, init: RequestInit & { json?: any } = {}): Promise<T> {
  const { json, ...rest } = init;
  const headers: Record<string, string> = { ...(rest.headers as any) };
  if (json !== undefined) { headers['Content-Type'] = 'application/json'; rest.body = JSON.stringify(json); }
  let res: Response;
  try { res = await fetch(url, { ...rest, headers, cache: 'no-store' }); }
  catch { throw new ApiFail('Network problem — check your connection and try again.', 0); }
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('json') ? await res.json().catch(() => ({})) : null;
  if (!res.ok) throw new ApiFail(data?.error || `Request failed (${res.status})`, res.status, data?.code);
  return data as T;
}

export function useApi<T = any>(url: string | null) {
  const [state, set] = useState<{ data: T | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: !!url });
  const seq = useRef(0);
  const load = useCallback(async (silent = false) => {
    if (!url) return;
    const my = ++seq.current;
    if (!silent) set(s => ({ ...s, loading: true, error: null }));
    try { const data = await api<T>(url); if (my === seq.current) set({ data, error: null, loading: false }); }
    catch (e: any) { if (my === seq.current) set(s => ({ data: silent ? s.data : null, error: e.message, loading: false })); }
  }, [url]);
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: () => load(true), refetch: () => load(false) };
}
