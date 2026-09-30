import { handler } from '@/lib/api';
import { requireUser } from '@/lib/session';
import { overview } from '@/lib/services/admin';

export const GET = handler(async () => { await requireUser('ADMIN'); return overview(); });
