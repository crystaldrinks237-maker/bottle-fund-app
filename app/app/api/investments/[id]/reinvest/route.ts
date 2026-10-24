import { handler, readJson, idParam } from '@/lib/api';
import { requireUser } from '@/lib/session';
import { setReinvest } from '@/lib/services/reinvest';

export const POST = handler(async (req, { params }) => setReinvest(await requireUser(), idParam(params.id), await readJson(req)));
