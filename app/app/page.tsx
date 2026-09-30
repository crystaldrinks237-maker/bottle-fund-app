import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';

export const dynamic = 'force-dynamic';
export default async function Home() {
  const u = await getCurrentUser();
  if (!u) redirect('/login');
  redirect(u.roles.includes('ADMIN') ? '/admin' : u.roles.includes('INVESTOR') ? '/dashboard' : '/guarantor');
}
