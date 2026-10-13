import { handler, readJson } from '@/lib/api';
import { submitContact } from '@/lib/services/website';
export const POST = handler(async req => {
  const ip = (req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
  return submitContact(ip, await readJson(req));
});
