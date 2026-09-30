import { handler, idParam } from '@/lib/api';
import { requireUser } from '@/lib/session';
import { quoteInvestment } from '@/lib/services/investments';

export const GET = handler(async (req, { params }) => {
  await requireUser('INVESTOR');
  return quoteInvestment(idParam(params.id), new URL(req.url).searchParams.get('amount'));
});
