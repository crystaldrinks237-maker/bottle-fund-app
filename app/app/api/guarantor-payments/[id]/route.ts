import { handler, readJson, idParam } from '@/lib/api';
import { requireUser } from '@/lib/session';
import { actOnGuarantorPayment, getGuarantorPayment } from '@/lib/services/guarantors';

export const GET = handler(async (_req, { params }) => getGuarantorPayment(await requireUser('ADMIN', 'GUARANTOR'), idParam(params.id)));
export const PATCH = handler(async (req, { params }) => actOnGuarantorPayment(await requireUser('ADMIN'), idParam(params.id), await readJson(req)));
