import { handler, readJson } from '@/lib/api';
import { requireUser, isAdmin } from '@/lib/session';
import { createNeed, listNeedsAdmin, listNeedsInvestor } from '@/lib/services/needs';

export const GET = handler(async req => {
  const u = await requireUser();
  return isAdmin(u) ? listNeedsAdmin(new URL(req.url)) : listNeedsInvestor();
});
export const POST = handler(async req => {
  const u = await requireUser('ADMIN');
  return createNeed(u, await readJson(req));
});
