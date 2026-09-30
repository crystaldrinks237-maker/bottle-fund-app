import { handler, readJson, idParam } from '@/lib/api';
import { requireUser } from '@/lib/session';
import { rejectInvestment } from '@/lib/services/investments';

export const POST = handler(async (req, { params }) => rejectInvestment(await requireUser('ADMIN'), idParam(params.id), (await readJson(req)).reason));
