import { handler, readJson, idParam, bad } from '@/lib/api';
import { requireUser } from '@/lib/session';
import { setAccountStatus } from '@/lib/services/accounts';

export const POST = handler(async (req, { params }) => {
  const u = await requireUser('ADMIN');
  const { action } = await readJson(req);
  if (action !== 'deactivate' && action !== 'reactivate') throw bad('Unknown action');
  return setAccountStatus(u, idParam(params.id), action);
});
