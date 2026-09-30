import { handler, readJson, idParam } from '@/lib/api';
import { requireUser } from '@/lib/session';
import { actOnPayout } from '@/lib/services/payouts';

export const PATCH = handler(async (req, { params }) => actOnPayout(await requireUser('ADMIN'), idParam(params.id), await readJson(req)));
