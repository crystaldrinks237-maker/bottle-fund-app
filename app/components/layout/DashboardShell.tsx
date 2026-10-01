'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { signOut } from 'next-auth/react';
import { Icon } from '../ui/Icon';
import { api } from '@/lib/client';
import { formatDateTime } from '@/lib/format';

interface Item { href: string; label: string; icon: string; exact?: boolean }
const NAV: Record<string, { title: string; items: Item[] }> = {
  ADMIN: { title: 'Operations', items: [
    { href: '/admin', label: 'Overview', icon: 'dashboard', exact: true }, { href: '/admin/funding-needs', label: 'Funding Needs', icon: 'layers' },
    { href: '/admin/investments', label: 'Investments', icon: 'wallet' }, { href: '/admin/payment-accounts', label: 'Payment Accounts', icon: 'card' },
    { href: '/admin/investors', label: 'Investors', icon: 'users' }, { href: '/admin/guarantors', label: 'Guarantors', icon: 'shield' },
    { href: '/admin/payouts', label: 'Investor Payouts', icon: 'cash' }, { href: '/admin/guarantor-payments', label: 'Guarantor Payments', icon: 'calendar' },
    { href: '/admin/claims', label: 'Payment Claims', icon: 'flag' }, { href: '/admin/activity', label: 'Activity Log', icon: 'list' }, { href: '/admin/settings', label: 'Settings', icon: 'gear' } ] },
  INVESTOR: { title: 'Investing', items: [
    { href: '/dashboard', label: 'Dashboard', icon: 'dashboard', exact: true }, { href: '/investments', label: 'My Investments', icon: 'wallet' },
    { href: '/funding-needs', label: 'Funding Needs', icon: 'layers' }, { href: '/payouts', label: 'Payouts', icon: 'cash' }, { href: '/profile', label: 'Profile', icon: 'user' } ] },
  GUARANTOR: { title: 'Guarantor', items: [
    { href: '/guarantor', label: 'Dashboard', icon: 'dashboard', exact: true }, { href: '/guarantor/payments', label: 'Monthly Payments', icon: 'calendar' }, ...[] ] },
};

function Bell() {
  const [open, setOpen] = useState(false); const [d, setD] = useState<any>({ rows: [], unread: 0 }); const ref = useRef<HTMLDivElement>(null);
  const load = () => api('/api/notifications').then(setD).catch(() => {});
  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, []);
  useEffect(() => { const h = (e: MouseEvent) => { if (open && ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, [open]);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="icon-btn" aria-label={`Notifications${d.unread ? `, ${d.unread} unread` : ''}`} aria-expanded={open} onClick={() => { setOpen(!open); if (!open) load(); }}>
        <Icon name="bell" />{d.unread > 0 && <span className="badge-dot">{d.unread > 9 ? '9+' : d.unread}</span>}
      </button>
      {open && (
        <div className="popover">
          <div className="card-head"><h3>Notifications</h3>{d.unread > 0 && <button className="btn btn-sm btn-ghost" onClick={async () => { await api('/api/notifications', { method: 'POST', json: {} }); load(); }}>Mark all read</button>}</div>
          {d.rows.length === 0 ? <p className="muted" style={{ padding: 20 }}>You’re all caught up.</p> : d.rows.map((n: any) => (
            <Link key={n.id} href={n.link || '/notifications'} className={`notif ${n.read_at ? '' : 'unread'}`} onClick={() => { setOpen(false); if (!n.read_at) api('/api/notifications', { method: 'POST', json: { id: n.id } }).then(load); }}>
              <b>{n.title}</b>{n.body && <span>{n.body}</span>}<span className="faint" style={{ display: 'block', marginTop: 2 }}>{formatDateTime(n.created_at)}</span>
            </Link>))}
          <Link href="/notifications" className="notif" style={{ textAlign: 'center', color: 'var(--blue)', fontWeight: 700 }} onClick={() => setOpen(false)}>View all</Link>
        </div>
      )}
    </div>
  );
}

export function DashboardShell({ user, children }: { user: { username: string; full_name: string | null; roles: string[] }; children: React.ReactNode }) {
  const path = usePathname(); const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  const groups = (['ADMIN', 'INVESTOR', 'GUARANTOR'] as const).filter(r => user.roles.includes(r)).map(r => NAV[r]);
  const active = (i: Item) => (i.exact ? path === i.href : path === i.href || path.startsWith(i.href + '/'));
  return (
    <div className="shell">
      <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Main navigation">
        <Link href="/" className="brand" style={{ textDecoration: 'none' }}>
          <Image src="/logo.png" alt="Crystal Drinks" width={54} height={58} priority /><div><b>Crystal Drinks</b><span>Funding platform</span></div>
        </Link>
        {groups.map(g => (
          <nav className="nav-group" key={g.title}>
            {groups.length > 1 && <div className="label">{g.title}</div>}
            {g.items.map(i => <Link key={i.href} href={i.href} className="nav-link" aria-current={active(i) ? 'page' : undefined}><Icon name={i.icon} />{i.label}</Link>)}
          </nav>
        ))}
        <div className="foot">
          <div style={{ fontWeight: 700 }}>{user.full_name || user.username}</div>
          <div className="small muted" style={{ marginBottom: 8 }}>@{user.username} · {user.roles.map(r => r.toLowerCase()).join(', ')}</div>
          <div className="row" style={{ gap: 4 }}>
            <Link href="/profile" className="btn btn-sm btn-ghost" style={{ paddingLeft: 0 }}><Icon name="user" />My profile</Link>
            <button className="btn btn-sm btn-ghost" onClick={() => signOut({ callbackUrl: '/login' })}><Icon name="logout" />Sign out</button>
          </div>
        </div>
      </aside>
      <div className={`scrim ${open ? 'open' : ''}`} onClick={() => setOpen(false)} />
      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setOpen(true)} aria-label="Open menu"><Icon name="menu" /></button>
          <Image src="/logo-mark.png" alt="" width={30} height={30} className="menu-btn" style={{ display: 'none' }} />
          <div className="grow" />
          <span className="small muted nowrap" title="All times are shown in this timezone">Times in {process.env.NEXT_PUBLIC_APP_TIMEZONE || 'Asia/Karachi'}</span>
          <Bell />
        </header>
        <main className="content" id="main">{children}</main>
      </div>
    </div>
  );
}
