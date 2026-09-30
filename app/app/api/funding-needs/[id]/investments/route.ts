import { handler, idParam } from '@/lib/api';
import { requireUser } from '@/lib/session';
import { listInvestments } from '@/lib/services/investments';

export const GET = handler(async (req, { params }) => {
  const u = await requireUser('ADMIN');
  return listInvestments(u, new URL(req.url), { forceNeedId: idParam(params.id) });
});
