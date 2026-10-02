import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { DashboardShell } from '@/components/layout/DashboardShell';

export const dynamic = 'force-dynamic';
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const u = await getCurrentUser();
  if (!u) redirect('/login');
  return <DashboardShell user={{ username: u.username, full_name: u.full_name, roles: u.roles }} viewingAs={!!u.viewingAs}>{children}</DashboardShell>;
}
