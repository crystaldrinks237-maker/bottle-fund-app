'use client';
import Link from 'next/link';
import { useApi } from '@/lib/client';
import { ErrorState, LoadingState, PageHeader, StatusBadge } from '@/components/ui/kit';
import { InvestForm } from '@/components/domain/InvestForm';

export default function NeedPage({ params }: { params: { id: string } }) {
  const { data, error, loading, refetch } = useApi<any>(`/api/funding-needs/${params.id}`);
  return (
    <>
      <p style={{ marginBottom: 14 }}><Link href="/funding-needs">← Funding needs</Link></p>
      {loading && !data ? <div className="card"><LoadingState /></div> : error ? <div className="card"><ErrorState message={error} onRetry={refetch} /></div> : data && (<>
        <PageHeader title={data.need.title} subtitle={data.need.product} actions={<StatusBadge status={data.need.status} />} />
        <InvestForm need={data.need} />
      </>)}
    </>
  );
}
