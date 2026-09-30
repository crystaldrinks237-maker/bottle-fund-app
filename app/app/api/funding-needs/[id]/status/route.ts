import { handler, readJson, idParam, bad } from '@/lib/api';
import { requireUser } from '@/lib/session';
import { changeNeedStatus } from '@/lib/services/needs';

export const POST = handler(async (req, { params }) => {
  const u = await requireUser('ADMIN');
  const b = await readJson(req);
  if (typeof b.action !== 'string') throw bad('Missing action');
  return changeNeedStatus(u, idParam(params.id), b.action, b.reason);
});
