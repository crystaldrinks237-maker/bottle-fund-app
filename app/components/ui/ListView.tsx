'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useApi } from '@/lib/client';
import { Icon } from './Icon';
import { EmptyState, ErrorState, LoadingState } from './kit';

export interface Column<T = any> { key: string; header: string; sort?: string; align?: 'right'; render?: (row: T, ctx: { reload: () => void }) => React.ReactNode; actions?: boolean }
export interface FilterDef { key: string; label: string; type: 'select' | 'date'; options?: { value: string; label: string }[] }

/**
 * Server-driven list: search, filters, sorting and pagination live in the URL (shareable, back-button friendly)
 * and every change re-queries the API — nothing is loaded wholesale.
 */
export function ListView<T = any>({ endpoint, columns, filters = [], search, defaultSort, empty, exportPath, extraParams, summary, rowKey = 'id' }: {
  endpoint: string; columns: Column<T>[]; filters?: FilterDef[]; search?: string; defaultSort?: string; empty?: { title: string; text?: string; action?: React.ReactNode };
  exportPath?: string; extraParams?: Record<string, string>; summary?: (data: any) => React.ReactNode; rowKey?: string;
}) {
  const sp = useSearchParams(); const router = useRouter(); const path = usePathname();
  const keys = ['q', 'page', 'sort', ...filters.map(f => f.key)];
  const qs = new URLSearchParams();
  keys.forEach(k => { const v = sp.get(k); if (v) qs.set(k, v); });
  Object.entries(extraParams || {}).forEach(([k, v]) => qs.set(k, v));
  const query = qs.toString();
  const { data, error, loading, reload, refetch } = useApi<{ rows: T[]; total: number; page: number; size: number }>(`${endpoint}?${query}`);
  const set = useCallback((patch: Record<string, string | null>) => {
    const n = new URLSearchParams(sp.toString());
    Object.entries(patch).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k)));
    if (!('page' in patch)) n.delete('page');
    router.replace(`${path}${n.toString() ? '?' + n : ''}`, { scroll: false });
  }, [sp, router, path]);

  const [q, setQ] = useState(sp.get('q') || ''); const first = useRef(true);
  useEffect(() => { if (first.current) { first.current = false; return; } const t = setTimeout(() => set({ q: q.trim() || null }), 350); return () => clearTimeout(t); }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const sort = sp.get('sort') || defaultSort || ''; const sortKey = sort.replace(/^-/, ''); const desc = sort.startsWith('-');
  const total = data ? (data.total ?? data.rows.length) : 0; const page = data?.page || 1; const pages = data ? Math.max(1, Math.ceil(total / (data.size || total || 1))) : 1;
  const active = keys.some(k => k !== 'page' && k !== 'sort' && sp.get(k));

  return (
    <div className="card">
      {(search || filters.length > 0 || exportPath) && (
        <div className="filters">
          {search && <label className="field grow"><span className="lbl">Search</span><div className="input-affix"><input className="input" style={{ paddingLeft: 12 }} type="search" value={q} onChange={e => setQ(e.target.value)} placeholder={search} /></div></label>}
          {filters.map(f => (
            <label className="field" key={f.key}><span className="lbl">{f.label}</span>
              {f.type === 'select'
                ? <select className="input" value={sp.get(f.key) || ''} onChange={e => set({ [f.key]: e.target.value || null })}><option value="">All</option>{f.options!.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
                : <input className="input" type="date" value={sp.get(f.key) || ''} onChange={e => set({ [f.key]: e.target.value || null })} />}
            </label>
          ))}
          {active && <button className="btn btn-sm btn-ghost" onClick={() => { setQ(''); router.replace(path, { scroll: false }); }}>Clear filters</button>}
          {exportPath && <a className="btn btn-sm" style={{ marginLeft: 'auto' }} href={`${exportPath}${exportPath.includes('?') ? '&' : '?'}${query.replace(/(^|&)page=\d+/, '')}${query ? '&' : ''}format=csv`}><Icon name="download" />Export CSV</a>}
        </div>
      )}
      {summary && data && <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--line)', background: '#FAFCFE' }} className="small muted">{summary(data)}</div>}
      {loading && !data ? <LoadingState rows={5} /> : error ? <ErrorState message={error} onRetry={refetch} /> : !data || data.rows.length === 0 ? (
        <EmptyState icon="search" title={active ? 'Nothing matches these filters' : empty?.title || 'Nothing here yet'} action={active ? undefined : empty?.action}>{active ? 'Try clearing a filter or searching for something else.' : empty?.text}</EmptyState>
      ) : (
        <>
          <div className="table-wrap" style={{ opacity: loading ? .6 : 1, transition: 'opacity .15s' }}>
            <table className="tbl responsive">
              <thead><tr>{columns.map(c => (
                <th key={c.key} className={c.align} aria-sort={c.sort && sortKey === c.sort ? (desc ? 'descending' : 'ascending') : undefined}>
                  {c.sort ? <button onClick={() => set({ sort: sortKey === c.sort && !desc ? `-${c.sort}` : c.sort! })}>{c.header}<Icon name="sort" size={12} /></button> : c.header}
                </th>))}</tr></thead>
              <tbody>{data.rows.map((r: any) => (
                <tr key={r[rowKey]}>{columns.map(c => <td key={c.key} data-label={c.actions ? '' : c.header} className={`${c.align || ''} ${c.actions ? 'actions' : ''}`}>{c.render ? c.render(r, { reload }) : r[c.key] ?? '—'}</td>)}</tr>))}
              </tbody>
            </table>
          </div>
          <div className="pager">
            <span>{total.toLocaleString()} result{total === 1 ? '' : 's'}{pages > 1 ? ` · page ${page} of ${pages}` : ''}</span>
            <span className="row"><button className="btn btn-sm" disabled={page <= 1} onClick={() => set({ page: String(page - 1) })}>Previous</button><button className="btn btn-sm" disabled={page >= pages} onClick={() => set({ page: String(page + 1) })}>Next</button></span>
          </div>
        </>
      )}
    </div>
  );
}
