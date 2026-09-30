'use client';
import Link from 'next/link';
import { statusMeta } from '@/lib/status';
import { formatMoney } from '@/lib/format';
import { Icon } from './Icon';

export function StatusBadge({ status, label }: { status: string | null | undefined; label?: string }) {
  if (!status) return null;
  const [text, tone] = statusMeta(status);
  return <span className={`badge ${tone === 'neutral' ? '' : tone}`}>{label || text}</span>;
}
export function MoneyDisplay({ value, strong }: { value: string | number | null | undefined; strong?: boolean }) {
  if (value === null || value === undefined || value === '') return <span className="faint">—</span>;
  const s = formatMoney(value, { symbol: false });
  return <span className="money nowrap" style={strong ? { fontWeight: 700 } : undefined}><small>PKR</small>{s}</span>;
}
export function StatCard({ label, value, sub, icon, href, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; icon?: string; href?: string; tone?: 'warn' | 'danger' | 'good' }) {
  const inner = (<><div className="k">{icon && <Icon name={icon} />}{label}</div><div className="v">{value}</div>{sub && <div className="s">{sub}</div>}</>);
  return href ? <Link href={href} className={`stat ${tone || ''}`}>{inner}</Link> : <div className={`stat ${tone || ''}`}>{inner}</div>;
}
export function ProgressBar({ funded, total }: { funded: string | number; total: string | number }) {
  const f = Number(funded), t = Number(total); const pct = t > 0 ? Math.min(100, (f / t) * 100) : 0;
  return (
    <div>
      <div className="progress-meta" style={{ marginTop: 0, marginBottom: 6, fontWeight: 600, color: 'var(--ink)' }}>
        <span><MoneyDisplay value={funded} strong /> funded</span><span className="muted">of <MoneyDisplay value={total} /> required</span>
      </div>
      <div className={`progress ${pct >= 100 ? 'done' : ''}`} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${pct}%` }} /></div>
      <div className="progress-meta"><span>{pct.toFixed(pct % 1 ? 1 : 0)}% funded</span><span>Remaining <MoneyDisplay value={t - f} /></span></div>
    </div>
  );
}
export function EmptyState({ icon = 'list', title, children, action }: { icon?: string; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return <div className="empty"><div className="ico"><Icon name={icon} /></div><h3>{title}</h3>{children && <p>{children}</p>}{action && <div style={{ marginTop: 14 }}>{action}</div>}</div>;
}
export function LoadingState({ rows = 4 }: { rows?: number }) {
  return <div style={{ padding: 20 }} aria-busy="true" aria-label="Loading">{Array.from({ length: rows }).map((_, i) => <div key={i} className="skel" style={{ height: 18, marginBottom: 14, width: `${92 - i * 9}%` }} />)}</div>;
}
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div style={{ padding: 20 }}><div className="errbox" role="alert"><b>Couldn’t load this.</b> {message}{onRetry && <div style={{ marginTop: 10 }}><button className="btn btn-sm" onClick={onRetry}>Try again</button></div>}</div></div>;
}
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return <div className="page-head"><div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{actions && <div className="row">{actions}</div>}</div>;
}
export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return <label className="field"><span className="lbl">{label}</span>{children}{hint && <span className="hint">{hint}</span>}{error && <span className="err">{error}</span>}</label>;
}
export function Tabs({ tabs, value, onChange }: { tabs: { id: string; label: string }[]; value: string; onChange: (id: string) => void }) {
  return <div className="tabs" role="tablist">{tabs.map(t => <button key={t.id} role="tab" aria-selected={t.id === value} onClick={() => onChange(t.id)}>{t.label}</button>)}</div>;
}
export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  return <button type="button" className="btn btn-sm btn-ghost copy" aria-label={`${label} ${text}`} onClick={() => navigator.clipboard?.writeText(text)}><Icon name="copy" />{label}</button>;
}
