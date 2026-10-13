import { handler } from '@/lib/api';
import { requireUser } from '@/lib/session';
import { adminReviews } from '@/lib/services/reviews';
export const dynamic = 'force-dynamic';
export const GET = handler(async req => { await requireUser('ADMIN'); return adminReviews(new URL(req.url).searchParams.get('status')); });
