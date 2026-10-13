'use client';
import { useEffect, useState } from 'react';
import { api, useApi } from '@/lib/client';
import { ErrorState, Field, LoadingState, PageHeader } from '@/components/ui/kit';
import { useToast } from '@/components/ui/Toast';

type Row = { id: number | null; name: string; bottles_per_pack: string; pack_price: string; note: string; sort_order: string; is_active: boolean };
const blank = (n: number): Row => ({ id: null, name: '', bottles_per_pack: '6', pack_price: '', note: '', sort_order: String((n + 1) * 10), is_active: true });
const fromApi = (r: any): Row => ({ id: r.id, name: r.name, bottles_per_pack: String(r.bottles_per_pack), pack_price: r.pack_price == null ? '' : String(Number(r.pack_price)), note: r.note || '', sort_order: String(r.sort_order), is_active: r.is_active });

export default function WebsiteAdmin() {
  const prices = useApi<{ rows: any[] }>('/api/admin/prices'); const settings = useApi<any>('/api/admin/site-settings'); const toast = useToast();
  const [rows, setRows] = useState<Row[]>([]); const [busy, setBusy] = useState<string | null>(null);
  const [addr, setAddr] = useState(''); const [embed, setEmbed] = useState('');
  useEffect(() => { if (prices.data) setRows(prices.data.rows.map(fromApi)); }, [prices.data]);
  useEffect(() => { if (settings.data) { setAddr(settings.data.address || ''); setEmbed(settings.data.map_embed || ''); } }, [settings.data]);
  const edit = (i: number, patch: Partial<Row>) => setRows(rs => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  async function save(i: number) {
    const r = rows[i]; setBusy(String(i));
    const json = { name: r.name, bottles_per_pack: r.bottles_per_pack, pack_price: r.pack_price.trim() === '' ? '' : r.pack_price, note: r.note, sort_order: r.sort_order, is_active: r.is_active };
    try {
      if (r.id) await api(`/api/admin/prices/${r.id}`, { method: 'PUT', json }); else await api('/api/admin/prices', { method: 'POST', json });
      toast.success('Saved — the website is updated'); prices.refetch();
    } catch (x: any) { toast.error(x.message); }
    setBusy(null);
  }
  async function remove(i: number) {
    const r = rows[i];
    if (!r.id) return setRows(rs => rs.filter((_, j) => j !== i));
    if (!confirm(`Delete “${r.name}” from the price table? (To hide it temporarily, untick “Show” instead.)`)) return;
    try { await api(`/api/admin/prices/${r.id}`, { method: 'DELETE' }); toast.success('Deleted'); prices.refetch(); } catch (x: any) { toast.error(x.message); }
  }
  async function saveSettings(e: React.FormEvent) {
    e.preventDefault(); setBusy('settings');
    try { const s = await api('/api/admin/site-settings', { method: 'PUT', json: { address: addr, map_embed: embed } }); setEmbed(s.map_embed); toast.success('Saved'); } catch (x: any) { toast.error(x.message); }
    setBusy(null);
  }

  return (
    <>
      <PageHeader title="Website" subtitle="The price table and location shown on the public homepage. Changes appear on the website immediately." actions={<a className="btn" href="/" target="_blank" rel="noopener">View website</a>} />
      <div className="card card-pad stack">
        <h2>Price table</h2>
        <p className="muted small">Prices are per pack. Leave the price empty to show “Ask on WhatsApp”. Lower “Order” numbers appear first. Remember: 500 ml = 12 bottles per pack, other sizes = 6.</p>
        {prices.loading && !prices.data ? <LoadingState /> : prices.error ? <ErrorState message={prices.error} onRetry={prices.refetch} /> : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ minWidth: 860 }}>
              <thead><tr><th>Size name</th><th>Bottles / pack</th><th>Price per pack (Rs)</th><th>Note (optional)</th><th>Order</th><th>Show</th><th></th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id ?? `new${i}`}>
                    <td><input className="input" value={r.name} onChange={e => edit(i, { name: e.target.value })} placeholder="e.g. 500 ml" aria-label="Size name" /></td>
                    <td><input className="input" style={{ width: 90 }} inputMode="numeric" value={r.bottles_per_pack} onChange={e => edit(i, { bottles_per_pack: e.target.value })} aria-label="Bottles per pack" /></td>
                    <td><input className="input" style={{ width: 130 }} inputMode="decimal" value={r.pack_price} onChange={e => edit(i, { pack_price: e.target.value })} placeholder="Ask on WhatsApp" aria-label="Price per pack" /></td>
                    <td><input className="input" value={r.note} onChange={e => edit(i, { note: e.target.value })} aria-label="Note" /></td>
                    <td><input className="input" style={{ width: 70 }} inputMode="numeric" value={r.sort_order} onChange={e => edit(i, { sort_order: e.target.value })} aria-label="Order" /></td>
                    <td><input type="checkbox" checked={r.is_active} onChange={e => edit(i, { is_active: e.target.checked })} aria-label="Show on website" /></td>
                    <td className="nowrap"><button className="btn btn-sm btn-primary" disabled={busy === String(i)} onClick={() => save(i)}>{busy === String(i) ? '…' : 'Save'}</button> <button className="btn btn-sm" onClick={() => remove(i)}>Delete</button></td>
                  </tr>))}
              </tbody>
            </table>
          </div>)}
        <div><button className="btn" onClick={() => setRows(rs => [...rs, blank(rs.length)])}>+ Add a bottle size</button></div>
      </div>

      <form className="card card-pad stack" style={{ marginTop: 18 }} onSubmit={saveSettings}>
        <h2>Location</h2>
        <Field label="Address (shown above the map)"><input className="input" value={addr} onChange={e => setAddr(e.target.value)} maxLength={300} /></Field>
        <Field label="Google Maps embed" hint="On Google Maps: open your business → Share → Embed a map → copy HTML, then paste it here. Leave empty to show only an “Open in Google Maps” button."><textarea className="input" rows={3} value={embed} onChange={e => setEmbed(e.target.value)} style={{ height: 'auto' }} placeholder='<iframe src="https://www.google.com/maps/embed?pb=…"></iframe>' /></Field>
        <div><button className="btn btn-primary" disabled={busy === 'settings'}>{busy === 'settings' ? 'Saving…' : 'Save location'}</button></div>
      </form>
    </>
  );
}
