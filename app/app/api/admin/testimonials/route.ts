import { handler, readJson } from '@/lib/api';
import { requireUser } from '@/lib/session';
import { adminCreate } from '@/lib/services/testimonials';

// Admin records a testimonial on behalf of a real customer who gave permission (the permission note is mandatory and audited).
export const POST = handler(async req => adminCreate(await requireUser('ADMIN'), await readJson(req)));
