import { handler, bad } from '@/lib/api';
import { requireUser } from '@/lib/session';
import { listInvestments, submitInvestment } from '@/lib/services/investments';
import { csvResponse, toCsv } from '@/lib/csv';

export const GET = handler(async req => {
  const u = await requireUser();
  const url = new URL(req.url);
  const csv = url.searchParams.get('format') === 'csv';
  if (csv && !u.roles.includes('ADMIN')) throw bad('Exports are for administrators');
  const out = await listInvestments(u, url, { unpaged: csv });
  if (csv) return csvResponse('investments', toCsv(out.rows, [
    { key: 'id', label: 'Investment ID' }, { key: 'investor_username', label: 'Investor' }, { key: 'guarantor_username', label: 'Guarantor' }, { key: 'snap_title', label: 'Funding need' },
    { key: 'amount', label: 'Amount' }, { key: 'display_status', label: 'Status' }, { key: 'account_name', label: 'Payment account' }, { key: 'created_at', label: 'Submitted (UTC)' },
    { key: 'verified_at', label: 'Verified (UTC)' }, { key: 'due_at', label: 'Due (UTC)' }, { key: 'expected_total_return', label: 'Expected return' }, { key: 'guarantor_profit', label: 'Guarantor profit' },
    { key: 'transaction_id', label: 'Payout transaction ID' }]));
  return out;
});

export const POST = handler(async req => {
  const u = await requireUser('INVESTOR');
  let form: FormData;
  try { form = await req.formData(); } catch { throw bad('Send the investment as a form upload'); }
  return submitInvestment(u, form);
});
