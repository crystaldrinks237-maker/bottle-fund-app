import { handler, readJson } from '@/lib/api';
import { requireUser } from '@/lib/session';
import { getSiteSettings, updateSiteSettings } from '@/lib/services/website';
export const dynamic = 'force-dynamic';
export const GET = handler(async () => { await requireUser('ADMIN'); return getSiteSettings(); });
export const PUT = handler(async req => updateSiteSettings(await requireUser('ADMIN'), await readJson(req)));
