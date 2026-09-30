import { handler, idParam, notFound } from '@/lib/api';
import { requireUser, isAdmin } from '@/lib/session';
import { listGuarantorPayments } from '@/lib/services/guarantors';

// Admins may view any guarantor's history; a guarantor only their own (compared against the session identity, not the URL alone).
export const GET = handler(async (req, { params }) => {
  const u = await requireUser('ADMIN', 'GUARANTOR');
  const id = idParam(params.id);
  if (!isAdmin(u) && id !== u.id) throw notFound();
  const url = new URL(req.url);
  url.searchParams.set('guarantor_id', String(id));
  return listGuarantorPayments(u, url);
});
