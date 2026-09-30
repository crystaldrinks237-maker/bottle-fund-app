import { handler, idParam } from '@/lib/api';
import { requireUser } from '@/lib/session';
import { getProofFile } from '@/lib/services/investments';

// Payment proofs are private: only the investor who uploaded it or an admin can fetch the bytes.
export const GET = handler(async (_req, { params }) => {
  const u = await requireUser();
  const f = await getProofFile(u, idParam(params.id));
  return new Response(new Uint8Array(f.data), {
    headers: { 'Content-Type': f.mime_type, 'Content-Disposition': 'inline', 'Cache-Control': 'private, max-age=600', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox" },
  });
});
