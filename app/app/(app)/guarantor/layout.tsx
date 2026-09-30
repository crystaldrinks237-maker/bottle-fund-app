import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';

export default async function Layout({ children }: { children: React.ReactNode }) {
  const u = await getCurrentUser();
  if (!u || !u.roles.includes('GUARANTOR')) redirect('/');
  return <>{children}</>;
}
