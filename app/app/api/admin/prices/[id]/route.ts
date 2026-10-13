import { handler, readJson, idParam } from '@/lib/api';
import { requireUser } from '@/lib/session';
import { updatePrice, deletePrice } from '@/lib/services/website';
export const PUT = handler(async (req, { params }) => updatePrice(await requireUser('ADMIN'), idParam(params.id), await readJson(req)));
export const DELETE = handler(async (_req, { params }) => deletePrice(await requireUser('ADMIN'), idParam(params.id)));
