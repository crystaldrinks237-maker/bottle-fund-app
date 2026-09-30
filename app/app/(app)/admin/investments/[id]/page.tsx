import Link from 'next/link';
import { InvestmentDetail } from '@/components/domain/InvestmentDetail';

export default function Page({ params }: { params: { id: string } }) {
  return (<><p style={{ marginBottom: 14 }}><Link href="/admin/investments">← Investments</Link></p><InvestmentDetail id={Number(params.id)} admin /></>);
}
