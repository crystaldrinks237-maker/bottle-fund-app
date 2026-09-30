import { handler, readJson, idParam } from '@/lib/api';
import { requireUser } from '@/lib/session';
import { actOnClaim } from '@/lib/services/claims';

export const PATCH = handler(async (req, { params }) => actOnClaim(await requireUser('ADMIN'), idParam(params.id), await readJson(req)));
