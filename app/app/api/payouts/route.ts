import { handler, bad } from '@/lib/api';
import { requireUser, isAdmin } from '@/lib/session';
import { listPayouts } from '@/lib/services/payouts';
import { csvResponse, toCsv } from '@/lib/csv';

export const GET = handler(async req => {
  const u = await requireUser();
  const url = new URL(req.url);
  const csv = url.searchParams.get('format') === 'csv';
  if (csv && !isAdmin(u)) throw bad('Exports are for administrators');
  const out = await listPayouts(u, url, csv);
  if (csv) return csvResponse('investor-payouts', toCsv(out.rows, [
    { key: 'id', label: 'Payout ID' }, { key: 'investment_id', label: 'Investment ID' }, { key: 'investor_username', label: 'Investor' }, { key: 'snap_title', label: 'Funding need' },
    { key: 'principal', label: 'Principal' }, { key: 'profit', label: 'Investor profit' }, { key: 'amount', label: 'Total payout' }, { key: 'display_status', label: 'Status' },
    { key: 'due_at', label: 'Due (UTC)' }, { key: 'paid_at', label: 'Paid (UTC)' }, { key: 'transaction_id', label: 'Transaction ID' }]));
  return out;
});
