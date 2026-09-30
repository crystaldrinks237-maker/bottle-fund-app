import { handler, readJson, idParam } from '@/lib/api';
import { requireUser } from '@/lib/session';
import { assignGuarantor } from '@/lib/services/guarantors';

export const PUT = handler(async (req, { params }) => {
  const u = await requireUser('ADMIN');
  const b = await readJson(req);
  return assignGuarantor(u, idParam(params.id), b.guarantor_id ? Number(b.guarantor_id) : null);
});
