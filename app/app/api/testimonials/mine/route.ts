import { handler } from '@/lib/api';
import { requireUser } from '@/lib/session';
import { reviewState } from '@/lib/services/testimonials';

export const GET = handler(async () => reviewState(await requireUser('INVESTOR')));
