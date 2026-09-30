import { handler, idParam } from '@/lib/api';
import { requireUser } from '@/lib/session';
import { verifyInvestment } from '@/lib/services/investments';

export const POST = handler(async (_req, { params }) => verifyInvestment(await requireUser('ADMIN'), idParam(params.id)));
