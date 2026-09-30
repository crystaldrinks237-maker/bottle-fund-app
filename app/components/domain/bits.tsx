'use client';
import { formatDateTime } from '@/lib/format';
import { Icon } from '../ui/Icon';
import { CopyButton } from '../ui/kit';

export interface Step { title: string; when?: string | null; state: 'done' | 'now' | 'todo' | 'fail'; note?: string }
export function Timeline({ steps }: { steps: Step[] }) {
  return (
    <ol className="timeline">
      {steps.map((s, i) => (
        <li key={i} className={s.state}>
          <span className="dot"><Icon name={s.state === 'fail' ? 'x' : 'check'} /></span>
          <b>{s.title}</b>{s.when && <span className="when">{formatDateTime(s.when)}</span>}{s.note && <span className="when" style={{ display: 'block' }}>{s.note}</span>}
        </li>
      ))}
    </ol>
  );
}

const PROVIDER: Record<string, string> = { BANK: 'Bank transfer', EASYPAISA: 'Easypaisa', JAZZCASH: 'JazzCash', OTHER: 'Other' };
export const providerLabel = (p: string) => PROVIDER[p] || p;

/** Renders an account (live) or a snapshot (historical) — same shape by design. */
export function AccountBox({ a, note }: { a: any; note?: string }) {
  if (!a) return <p className="muted">No payment account recorded.</p>;
  const wallet = a.provider !== 'BANK';
  return (
    <div className="acct">
      <div className="row between"><b>{a.account_name}</b><span className="badge info">{providerLabel(a.provider)}</span></div>
      <dl className="kv" style={{ marginTop: 12 }}>
        {!wallet && a.bank_name && <><dt>Bank</dt><dd>{a.bank_name}</dd></>}
        <dt>Account holder</dt><dd>{a.account_holder_name}</dd>
        <dt>{wallet ? 'Mobile / account no.' : 'Account number'}</dt><dd><span className="mono">{a.account_number}</span><CopyButton text={a.account_number} /></dd>
        {a.iban && <><dt>IBAN</dt><dd><span className="mono">{a.iban}</span><CopyButton text={a.iban} /></dd></>}
        {a.instructions && <><dt>Instructions</dt><dd>{a.instructions}</dd></>}
      </dl>
      {note && <p className="small muted" style={{ marginTop: 10 }}>{note}</p>}
    </div>
  );
}

export function KV({ items }: { items: [string, React.ReactNode][] }) {
  return <dl className="kv">{items.filter(([, v]) => v !== undefined).map(([k, v]) => <div key={k} style={{ display: 'contents' }}><dt>{k}</dt><dd>{v ?? '—'}</dd></div>)}</dl>;
}
