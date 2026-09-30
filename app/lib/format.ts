import { APP_TIMEZONE } from './config';

/** Display-only helpers (safe on client and server). Never used for business logic. */
export function formatMoney(v: string | number | null | undefined, opts: { symbol?: boolean } = {}): string {
  if (v === null || v === undefined || v === '') return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  const hasFraction = Math.abs(n % 1) > 0;
  const s = new Intl.NumberFormat('en-PK', { minimumFractionDigits: hasFraction ? 2 : 0, maximumFractionDigits: 2 }).format(n);
  return opts.symbol === false ? s : `PKR ${s}`;
}
export function formatDateTime(v: string | Date | null | undefined): string {
  if (!v) return '—';
  return new Intl.DateTimeFormat('en-GB', { timeZone: APP_TIMEZONE, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date(v));
}
export function formatDate(v: string | Date | null | undefined): string {
  if (!v) return '—';
  return new Intl.DateTimeFormat('en-GB', { timeZone: APP_TIMEZONE, day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(v));
}
export function formatMonth(v: string | Date | null | undefined): string {
  if (!v) return '—';
  const s = typeof v === 'string' ? v.slice(0, 10) : v.toISOString().slice(0, 10);
  const [y, m] = s.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(new Date(Date.UTC(y, m - 1, 1)));
}
export const tzLabel = () => APP_TIMEZONE;
export function pct(v: string | number | null | undefined) { return v == null ? '—' : `${Number(v)}%`; }
export function titleCase(s: string) { return s.toLowerCase().replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase()); }
