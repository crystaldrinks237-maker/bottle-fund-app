import { formatMoney } from '@/lib/format';

export function BarChart({ data }: { data: { label: string; value: number; hot?: boolean; title?: string }[] }) {
  const max = Math.max(1, ...data.map(d => d.value));
  return (
    <div className="bars" role="img" aria-label="Payout obligations by day">
      {data.map((d, i) => (
        <div className={`bar ${d.hot ? 'hot' : ''}`} key={i} title={d.title || formatMoney(d.value)}>
          <i style={{ height: `${Math.max(2, (d.value / max) * 100)}%` }} /><span>{d.label}</span>
        </div>
      ))}
    </div>
  );
}
