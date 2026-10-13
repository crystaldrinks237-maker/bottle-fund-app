import { handler, readJson, idParam } from '@/lib/api';
import { requireUser } from '@/lib/session';
import { updateSize, deleteSize } from '@/lib/services/website';
export const PUT = handler(async (req, { params }) => updateSize(await requireUser('ADMIN'), idParam(params.id), await readJson(req)));
export const DELETE = handler(async (_req, { params }) => deleteSize(await requireUser('ADMIN'), idParam(params.id)));
