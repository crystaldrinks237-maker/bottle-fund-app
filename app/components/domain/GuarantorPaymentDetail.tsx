'use client';
import { useApi } from '@/lib/client';
import { formatDateTime, formatMonth } from '@/lib/format';
import { Modal } from '../ui/Modal';
import { ErrorState, LoadingState, MoneyDisplay, StatusBadge } from '../ui/kit';
import { KV } from './bits';

export function GuarantorPaymentDetail({ id, admin, onClose }: { id: number; admin?: boolean; onClose: () => void }) {
  const { data, error, loading, refetch } = useApi<any>(`/api/guarantor-payments/${id}`);
  return (
    <Modal title={data ? `${formatMonth(data.payment.period_month)} · ${data.payment.guarantor_username}` : 'Payment'} onClose={onClose} size="wide">
      {loading && !data ? <LoadingState /> : error ? <ErrorState message={error} onRetry={refetch} /> : data && (<div className="stack">
        <KV items={[['Status', <StatusBadge status={data.payment.status} key="s" />], ['Amount', <MoneyDisplay value={data.payment.amount} strong key="a" />], ['Transaction ID', data.payment.transaction_id ? <span className="mono">{data.payment.transaction_id}</span> : '—'],
          ['Paid on', formatDateTime(data.payment.paid_at)], ...(data.payment.replacement_transaction_id ? [['Replacement transaction', <span className="mono" key="r">{data.payment.replacement_transaction_id}</span>] as [string, React.ReactNode]] : []),
          ...(admin ? [['Paid to', data.payment.paid_to || '—'] as [string, React.ReactNode], ['Internal notes', data.payment.notes || '—'] as [string, React.ReactNode]] : [])]} />
        {data.claims.map((c: any) => <div key={c.id} className={`notice ${c.status === 'RESOLVED' ? 'good' : c.status === 'REJECTED' ? 'bad' : 'warn'}`}><b>Claim #{c.id} · {c.status.toLowerCase().replace('_', ' ')}</b> — “{c.reason}” {c.resolution_note && <div style={{ marginTop: 4 }}>Response: {c.resolution_note}</div>}</div>)}
        <div><h3 style={{ marginBottom: 8 }}>Earnings included ({data.items.length})</h3>
          <div className="table-wrap"><table className="tbl responsive"><thead><tr><th>Investment</th><th>Investor</th><th>Verified</th><th className="right">Investment amount</th><th className="right">Earning</th></tr></thead>
            <tbody>{data.items.map((x: any) => <tr key={x.investment_id}><td data-label="Investment">#{x.investment_id} · {x.snap_title}</td><td data-label="Investor">{x.investor_username}</td><td data-label="Verified">{formatDateTime(x.verified_at)}</td><td data-label="Amount" className="right"><MoneyDisplay value={x.investment_amount} /></td><td data-label="Earning" className="right"><MoneyDisplay value={x.amount} strong /></td></tr>)}</tbody></table></div></div>
      </div>)}
    </Modal>
  );
}
