import { handler, readJson } from '@/lib/api';
import { submitReview } from '@/lib/services/reviews';
export const POST = handler(async req => {
  const ip = (req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
  return submitReview(ip, await readJson(req));
});
