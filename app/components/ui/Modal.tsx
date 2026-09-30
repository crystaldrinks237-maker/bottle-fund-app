'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from './Icon';

export function Modal({ title, subtitle, onClose, children, footer, size }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; size?: 'wide' | 'xl' }) {
  const ref = useRef<HTMLDivElement>(null); const id = useId();
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && ref.current) { // keep focus inside the dialog
        const f = ref.current.querySelectorAll<HTMLElement>('a[href],button:not(:disabled),input:not(:disabled),select,textarea,[tabindex]:not([tabindex="-1"])');
        if (!f.length) return; const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', key); document.body.style.overflow = 'hidden';
    ref.current?.querySelector<HTMLElement>('input,textarea,select')?.focus();
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = ''; prev?.focus(); };
  }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal ${size || ''}`} role="dialog" aria-modal="true" aria-labelledby={id} ref={ref}>
        <div className="modal-head">
          <div><h2 id={id}>{title}</h2>{subtitle && <p className="muted small" style={{ marginTop: 4 }}>{subtitle}</p>}</div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export interface DialogField { name: string; label: string; type?: 'text' | 'textarea'; required?: boolean; placeholder?: string; hint?: string; minLength?: number; initial?: string }

/** Confirmation dialog with optional required inputs (reason, transaction ID, notes). Errors from onConfirm show inline. */
export function ConfirmDialog({ title, description, confirmLabel, tone, fields = [], onConfirm, onClose }: {
  title: string; description?: React.ReactNode; confirmLabel: string; tone?: 'danger' | 'success' | 'primary'; fields?: DialogField[];
  onConfirm: (values: Record<string, string>) => Promise<void>; onClose: () => void;
}) {
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(fields.map(f => [f.name, f.initial || ''])));
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const missing = fields.some(f => f.required && (vals[f.name] || '').trim().length < (f.minLength || 1));
  async function go(e?: React.FormEvent) {
    e?.preventDefault(); if (busy || missing) return;
    setBusy(true); setErr('');
    try { await onConfirm(vals); onClose(); } catch (x: any) { setErr(x.message || 'Something went wrong'); setBusy(false); }
  }
  const cls = tone === 'danger' ? 'btn btn-danger solid' : tone === 'success' ? 'btn btn-success' : 'btn btn-primary';
  return (
    <Modal title={title} onClose={busy ? () => {} : onClose}
      footer={<><button className="btn" onClick={onClose} disabled={busy}>Cancel</button><button className={cls} onClick={() => go()} disabled={busy || missing}>{busy ? 'Working…' : confirmLabel}</button></>}>
      <form onSubmit={go} className="stack-sm">
        {description && <div className="muted">{description}</div>}
        {fields.map(f => (
          <label className="field" key={f.name}>
            <span className="lbl">{f.label}{f.required ? '' : ' (optional)'}</span>
            {f.type === 'textarea'
              ? <textarea className="input" value={vals[f.name]} placeholder={f.placeholder} onChange={e => setVals({ ...vals, [f.name]: e.target.value })} />
              : <input className="input" value={vals[f.name]} placeholder={f.placeholder} onChange={e => setVals({ ...vals, [f.name]: e.target.value })} />}
            {f.hint && <span className="hint">{f.hint}</span>}
          </label>
        ))}
        {err && <div className="errbox" role="alert">{err}</div>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
