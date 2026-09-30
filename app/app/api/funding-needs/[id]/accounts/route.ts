import { z } from 'zod';
import { handler, readJson, idParam } from '@/lib/api';
import { requireUser } from '@/lib/session';
import { setNeedAccounts } from '@/lib/services/needs';
import { idSchema } from '@/lib/validators';

export const PUT = handler(async (req, { params }) => {
  const u = await requireUser('ADMIN');
  const b = z.object({ account_ids: z.array(idSchema).max(20) }).parse(await readJson(req));
  return setNeedAccounts(u, idParam(params.id), b.account_ids);
});
