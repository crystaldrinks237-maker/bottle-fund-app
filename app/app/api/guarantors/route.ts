import { handler, readJson } from '@/lib/api';
import { requireUser } from '@/lib/session';
import { createOrGrantGuarantor, listGuarantors } from '@/lib/services/guarantors';

export const GET = handler(async req => { await requireUser('ADMIN'); return listGuarantors(new URL(req.url)); });
export const POST = handler(async req => createOrGrantGuarantor(await requireUser('ADMIN'), await readJson(req)));
