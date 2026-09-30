import { handler, readJson } from '@/lib/api';
import { requireUser } from '@/lib/session';
import { createAccount, listAccounts } from '@/lib/services/accounts';
import { csvResponse, toCsv } from '@/lib/csv';

export const GET = handler(async req => {
  await requireUser('ADMIN');
  const url = new URL(req.url);
  const out = await listAccounts(url);
  if (url.searchParams.get('format') === 'csv')
    return csvResponse('payment-accounts', toCsv(out.rows, [
      { key: 'id', label: 'ID' }, { key: 'account_name', label: 'Account' }, { key: 'provider', label: 'Provider' }, { key: 'status', label: 'Status' }, { key: 'availability', label: 'Availability' },
      { key: 'total_limit', label: 'Total limit' }, { key: 'allocated_amount', label: 'Allocated' }, { key: 'remaining_amount', label: 'Remaining' }, { key: 'daily_limit', label: 'Daily limit' }, { key: 'today_amount', label: 'Today' }, { key: 'assigned_needs', label: 'Assigned needs' }]));
  return out;
});
export const POST = handler(async req => createAccount(await requireUser('ADMIN'), await readJson(req)));
