'use client';
import Link from 'next/link';
import { useApi } from '@/lib/client';
import { formatDateTime, formatMoney, pct } from '@/lib/format';
import { Countdown } from '../ui/Countdown';
import { ErrorState, LoadingState, MoneyDisplay, StatusBadge } from '../ui/kit';
import { AccountBox, KV, Step, Timeline } from './bits';
import { InvestmentActions, PayoutActions, ProofButton, ReportNotReceived } from './actions';

export function InvestmentDetail({ id, admin }: { id: number; admin?: boolean }) {
  const { data: i, error, loading, reload, refetch } = useApi<any>(`/api/investments/${id}`);
  if (loading && !i) return <div className="card"><LoadingState rows={6} /></div>;
  if (error || !i) return <div className="card"><ErrorState message={error || 'Not found'} onRetry={refetch} /></div>;
  const s = i.display_status;
  const verified = ['VERIFIED', 'PAYOUT_DUE', 'COMPLETED'].includes(s);
  const rejected = s === 'REJECTED';
  const paid = ['PAID', 'CLAIMED_NOT_RECEIVED', 'RESOLVED'].includes(i.payout_status || '');
  const steps: Step[] = [
    { title: 'Investment submitted', when: i.created_at, state: 'done' },
    rejected ? { title: 'Payment rejected', when: i.rejected_at, state: 'fail', note: i.rejection_reason } : { title: 'Payment verified', when: i.verified_at, state: verified ? 'done' : 'now' },
    { title: '7-day countdown', when: verified ? i.verified_at : null, state: rejected ? 'todo' : s === 'VERIFIED' ? 'now' : verified ? 'done' : 'todo' },
    { title: 'Payout due', when: verified ? i.due_at : null, state: rejected ? 'todo' : s === 'PAYOUT_DUE' ? 'now' : s === 'COMPLETED' ? 'done' : 'todo' },
    { title: 'Payout sent', when: i.paid_at, state: paid ? 'done' : 'todo', note: paid && i.transaction_id ? `Transaction ID ${i.transaction_id}` : undefined },
    { title: 'Completed', state: s === 'COMPLETED' ? 'done' : 'todo' },
  ];
  return (
    <div className="stack">
      <div className="row between">
        <div className="row"><h1>Investment #{i.id}</h1><StatusBadge status={s} /></div>
        <div className="row">{admin && <InvestmentActions inv={i} onDone={reload} />}</div>
      </div>
      <div className="grid2" style={{ alignItems: 'start' }}>
        <div className="stack">
          {s === 'VERIFIED' && <div className="card card-pad"><div className="muted small" style={{ marginBottom: 8, fontWeight: 600 }}>Time until payout is due</div><Countdown dueAt={i.due_at} serverNow={i.server_now} onElapsed={reload} /></div>}
          {s === 'PAYOUT_DUE' && <div className="notice warn"><b>Payout due.</b> The 7-day period ended {formatDateTime(i.due_at)}. {admin ? 'Record the payment below once sent.' : 'It will be sent shortly and appear here with a transaction ID.'}</div>}
          {rejected && <div className="notice bad"><b>Payment rejected.</b> {i.rejection_reason}</div>}
          {s === 'PENDING_VERIFICATION' && <div className="notice warn">Waiting for payment verification. The 7-day countdown starts only once an administrator verifies your payment.</div>}
          <div className="card"><div className="card-head"><h2>Investment</h2></div><div className="card-pad">
            <KV items={[
              ['Funding need', admin ? <Link href={`/admin/funding-needs/${i.funding_need_id}`}>{i.snap_title}</Link> : i.snap_title], ['Product', i.snap_product],
              ['Investment amount', <MoneyDisplay value={i.amount} strong />], ['Investor profit share', pct(i.snap_investor_pct)],
              [verified ? 'Expected profit' : 'Expected profit (estimate)', <MoneyDisplay value={i.expected_investor_profit} />],
              [verified ? 'Expected return' : 'Expected return (estimate)', <MoneyDisplay value={i.expected_total_return} strong />],
              ['Submitted', formatDateTime(i.created_at)], ['Verified at', formatDateTime(i.verified_at)], ['Payout due at (exact)', formatDateTime(i.due_at)],
            ]} />
            {!i.expected_is_final && <p className="small muted" style={{ marginTop: 10 }}>Figures are final once your payment is verified and are never changed afterwards, even if the funding need’s terms are edited.</p>}
          </div></div>
        </div>
        <div className="stack">
          <div className="card"><div className="card-head"><h2>Progress</h2></div><div className="card-pad"><Timeline steps={steps} /></div></div>
        </div>
      </div>
      <div className="grid2" style={{ alignItems: 'start' }}>
        <div className="card"><div className="card-head"><h2>Payment account used</h2><ProofButton proofId={i.proof_id} label="View payment proof" /></div>
          <div className="card-pad"><AccountBox a={i.payment_snapshot} note={`Details as shown when this investment was submitted (${formatDateTime(i.payment_snapshot?.snapshotted_at)}). They never change, even if the account is edited later.`} /></div></div>
        <div className="card"><div className="card-head"><h2>Payout</h2>{i.payout_status && <StatusBadge status={i.display_status === 'PAYOUT_DUE' && i.payout_status === 'DUE' ? 'DUE' : i.payout_status} />}</div>
          <div className="card-pad stack-sm">
            {!i.payout_id ? <p className="muted">A payout is created when the payment is verified.</p> : (<>
              <KV items={[['Payout amount', <MoneyDisplay value={i.payout_amount} strong />], ['Status', i.payout_status === 'PAID' ? 'Paid' : i.payout_status?.toLowerCase().replace(/_/g, ' ')],
                ['Transaction ID', i.transaction_id ? <span className="mono">{i.transaction_id}</span> : '—'], ['Paid on', formatDateTime(i.paid_at)],
                ...(i.payout_replacement_txn ? [['Replacement transaction', <span className="mono" key="r">{i.payout_replacement_txn}</span>] as [string, React.ReactNode]] : [])]} />
              {admin && <div className="row" style={{ marginTop: 8 }}><PayoutActions p={{ ...i, id: i.payout_id, amount: i.payout_amount, display_status: i.payout_status === 'DUE' && i.due_at > i.server_now ? 'SCHEDULED' : i.payout_status }} onDone={reload} /></div>}
              {!admin && i.payout_status === 'PAID' && <ReportNotReceived target={{ payout_id: i.payout_id }} onDone={reload} />}
              {!admin && i.payout_status === 'CLAIMED_NOT_RECEIVED' && <div className="notice warn">You reported this payment as not received. An administrator is reviewing it.</div>}
            </>)}
          </div></div>
      </div>
      {admin && (
        <div className="card"><div className="card-head"><h2>Admin details</h2></div><div className="card-pad"><KV items={[
          ['Investor', <>{i.investor_username}{i.investor_full_name ? ` · ${i.investor_full_name}` : ''}</>], ['Phone', i.investor_phone || '—'],
          ['Payout destination', i.payout_account ? `${i.payout_method || ''} ${i.payout_account}` : 'Not provided'],
          ['Guarantor', i.guarantor_username ? <>{i.guarantor_username}{i.guarantor_is_fallback && <span className="badge info" style={{ marginLeft: 8 }}>fallback share</span>}</> : i.legacy_referrer_username || 'None'], ['Guarantor earnings', i.guarantor_profit != null ? formatMoney(i.guarantor_profit) : '—'],
          ['Business profit', i.business_profit != null ? formatMoney(i.business_profit) : '—'], ['Reviewed by', i.reviewed_by_username || '—'],
          ['Payment account', i.account_name ? `${i.account_name} (ID ${i.payment_account_id})` : '—'],
        ]} /></div></div>
      )}
    </div>
  );
}
