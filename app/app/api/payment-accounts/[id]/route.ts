import { handler, readJson, idParam } from '@/lib/api';
import { requireUser } from '@/lib/session';
import { getAccount, updateAccount } from '@/lib/services/accounts';

export const GET = handler(async (_req, { params }) => { await requireUser('ADMIN'); return getAccount(idParam(params.id)); });
export const PATCH = handler(async (req, { params }) => updateAccount(await requireUser('ADMIN'), idParam(params.id), await readJson(req)));
