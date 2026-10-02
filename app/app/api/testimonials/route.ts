import { handler, readJson } from '@/lib/api';
import { requireUser } from '@/lib/session';
import { listTestimonials, submitMine } from '@/lib/services/testimonials';

export const GET = handler(async req => { await requireUser('ADMIN'); return listTestimonials(new URL(req.url)); });
export const POST = handler(async req => submitMine(await requireUser('INVESTOR'), await readJson(req)));
