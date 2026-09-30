import { handler, readJson } from '@/lib/api';
import { requireUser } from '@/lib/session';
import { getSettings, updateSettings } from '@/lib/services/admin';

export const GET = handler(async () => { await requireUser('ADMIN'); return getSettings(); });
export const PUT = handler(async req => updateSettings(await requireUser('ADMIN'), await readJson(req)));
