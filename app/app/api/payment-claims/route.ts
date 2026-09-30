import { handler, readJson } from '@/lib/api';
import { requireUser } from '@/lib/session';
import { createClaim, listClaims } from '@/lib/services/claims';

export const GET = handler(async req => listClaims(await requireUser(), new URL(req.url)));
export const POST = handler(async req => createClaim(await requireUser('GUARANTOR', 'INVESTOR'), await readJson(req)));
