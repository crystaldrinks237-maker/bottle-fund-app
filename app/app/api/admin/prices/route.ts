import { handler, readJson } from '@/lib/api';
import { requireUser } from '@/lib/session';
import { adminPrices, createPrice } from '@/lib/services/website';
export const dynamic = 'force-dynamic';
export const GET = handler(async () => { await requireUser('ADMIN'); return { rows: await adminPrices() }; });
export const POST = handler(async req => createPrice(await requireUser('ADMIN'), await readJson(req)));
