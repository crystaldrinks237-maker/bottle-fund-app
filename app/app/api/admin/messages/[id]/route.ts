import { handler, readJson, idParam } from '@/lib/api';
import { requireUser } from '@/lib/session';
import { markMessage } from '@/lib/services/website';
export const PUT = handler(async (req, { params }) => { await requireUser('ADMIN'); const b = await readJson(req); return markMessage(idParam(params.id), !!b.is_read); });
