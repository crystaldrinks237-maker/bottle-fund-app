import { handler, readJson, idParam } from '@/lib/api';
import { requireUser } from '@/lib/session';
import { rollOverPayout } from '@/lib/services/reinvest';

export const POST = handler(async (req, { params }) => rollOverPayout(await requireUser('ADMIN'), idParam(params.id), await readJson(req)));
