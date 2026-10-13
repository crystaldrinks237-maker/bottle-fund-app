import { handler, readJson, idParam } from '@/lib/api';
import { requireUser } from '@/lib/session';
import { reviewAction, deleteReview } from '@/lib/services/reviews';
export const PUT = handler(async (req, { params }) => reviewAction(await requireUser('ADMIN'), idParam(params.id), String((await readJson(req)).action)));
export const DELETE = handler(async (_req, { params }) => deleteReview(await requireUser('ADMIN'), idParam(params.id)));
