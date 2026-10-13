import { handler, readJson } from '@/lib/api';
import { requireUser } from '@/lib/session';
import { adminSizes, createSize } from '@/lib/services/website';
export const dynamic = 'force-dynamic';
export const GET = handler(async () => { await requireUser('ADMIN'); return { rows: await adminSizes() }; });
export const POST = handler(async req => createSize(await requireUser('ADMIN'), await readJson(req)));
