import { handler, readJson, idParam } from '@/lib/api';
import { requireUser } from '@/lib/session';
import { actOnTestimonial } from '@/lib/services/testimonials';

export const PATCH = handler(async (req, { params }) => actOnTestimonial(await requireUser('ADMIN'), idParam(params.id), await readJson(req)));
