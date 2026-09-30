import { handler, idParam } from '@/lib/api';
import { requireUser } from '@/lib/session';
import { getInvestment } from '@/lib/services/investments';

export const GET = handler(async (_req, { params }) => getInvestment(await requireUser(), idParam(params.id)));
