import { handler } from '@/lib/api';
import { requireUser } from '@/lib/session';
import { listInvestorsAdmin } from '@/lib/services/guarantors';

export const GET = handler(async req => { await requireUser('ADMIN'); return listInvestorsAdmin(new URL(req.url)); });
