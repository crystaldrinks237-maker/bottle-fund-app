import { handler } from '@/lib/api';
import { requireUser } from '@/lib/session';
import { adminMessages } from '@/lib/services/website';
export const dynamic = 'force-dynamic';
export const GET = handler(async () => { await requireUser('ADMIN'); return { rows: await adminMessages() }; });
