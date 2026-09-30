'use client';
import { useEffect, useState } from 'react';
import { formatDateTime } from '@/lib/format';

/**
 * Presentation only. `dueAt` and `serverNow` both come from the database; we measure the browser's clock
 * offset once against `serverNow` so a wrong device clock or timezone cannot skew the display.
 * Business state (PAYOUT_DUE) is decided server-side from due_at, never by this timer.
 */
export function Countdown({ dueAt, serverNow, onElapsed }: { dueAt: string; serverNow: string; onElapsed?: () => void }) {
  const [offset] = useState(() => new Date(serverNow).getTime() - Date.now());
  const [now, setNow] = useState(() => Date.now() + offset);
  const left = new Date(dueAt).getTime() - now;
  useEffect(() => { const t = setInterval(() => setNow(Date.now() + offset), 1000); return () => clearInterval(t); }, [offset]);
  const elapsed = left <= 0;
  useEffect(() => { if (elapsed) onElapsed?.(); }, [elapsed]); // eslint-disable-line react-hooks/exhaustive-deps
  if (elapsed) return <div><div className="countdown due">Payout due</div><small className="muted">Was due {formatDateTime(dueAt)}</small></div>;
  const s = Math.floor(left / 1000), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return (
    <div>
      <div className="countdown" role="timer" aria-label={`${d} days ${h} hours ${m} minutes remaining`}>{d}d {h}h {String(m).padStart(2, '0')}m {String(sec).padStart(2, '0')}s</div>
      <small className="muted">until {formatDateTime(dueAt)}</small>
    </div>
  );
}
