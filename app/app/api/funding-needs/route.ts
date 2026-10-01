import { handler, readJson } from '@/lib/api';
import { requireUser, isAdmin } from '@/lib/session';
import { createNeed, listNeedsAdmin, listNeedsInvestor } from '@/lib/services/needs';

export const GET = handler(async req => {
  const u = await requireUser();
  const url = new URL(req.url);
  return isAdmin(u) && url.searchParams.get('view') !== 'investor' ? listNeedsAdmin(url) : listNeedsInvestor();
});
export const POST = handler(async req => {
  const u = await requireUser('ADMIN');
  return createNeed(u, await readJson(req));
});
