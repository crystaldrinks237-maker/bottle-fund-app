'use client';
import { useState } from 'react';
import { api } from '@/lib/client';
import { ConfirmDialog } from '../ui/Modal';

/** Admin-only. Opens the app exactly as this user sees it — read-only, 30 minutes, logged. Hidden for admin accounts. */
export function ViewAsButton({ user, landing }: { user: any; landing?: 'investor' | 'guarantor' }) {
  const [open, setOpen] = useState(false);
  if (user.roles?.includes('ADMIN') || !user.is_active) return null;
  return (<>
    <button className="btn btn-sm" onClick={() => setOpen(true)}>View as</button>
    {open && <ConfirmDialog title={`View the app as @${user.username}?`} confirmLabel="Start viewing" tone="primary" onClose={() => setOpen(false)}
      description="You will see exactly what they see — their dashboard, investments, payouts and profile. It is read-only (nothing can be changed), lasts up to 30 minutes, and the start and end are recorded in the activity log."
      onConfirm={async () => { const r = await api('/api/admin/impersonate', { method: 'POST', json: { user_id: user.id, landing } }); window.location.href = r.redirect; }} />}
  </>);
}
