import { handler, readJson, bad } from '@/lib/api';
import { requireUser, isAdmin } from '@/lib/session';
import { generateSettlement, listGuarantorPayments, settlementPreview } from '@/lib/services/guarantors';
import { csvResponse, toCsv } from '@/lib/csv';

export const GET = handler(async req => {
  const u = await requireUser('ADMIN', 'GUARANTOR');
  const url = new URL(req.url);
  if (url.searchParams.get('preview') === '1') {
    if (!isAdmin(u)) throw bad('Not allowed');
    return { rows: await settlementPreview(url.searchParams.get('month') || '') };
  }
  const csv = url.searchParams.get('format') === 'csv';
  if (csv && !isAdmin(u)) throw bad('Exports are for administrators');
  const out = await listGuarantorPayments(u, url, csv);
  if (csv) return csvResponse('guarantor-payments', toCsv(out.rows, [
    { key: 'id', label: 'Payment ID' }, { key: 'guarantor_username', label: 'Guarantor' }, { key: 'period_month', label: 'Period' }, { key: 'amount', label: 'Amount' },
    { key: 'status', label: 'Status' }, { key: 'transaction_id', label: 'Transaction ID' }, { key: 'paid_at', label: 'Paid (UTC)' }, { key: 'items', label: 'Investments' }]));
  return out;
});
export const POST = handler(async req => generateSettlement(await requireUser('ADMIN'), (await readJson(req)).month));
