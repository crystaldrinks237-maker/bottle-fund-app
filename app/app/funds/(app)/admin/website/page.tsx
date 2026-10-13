'use client';
import { useEffect, useState } from 'react';
import { api, useApi } from '@/lib/client';
import { ErrorState, Field, LoadingState, PageHeader } from '@/components/ui/kit';
import { useToast } from '@/components/ui/Toast';

const QUALITIES = ['Clear', 'Getron', 'Mix', 'Pure'];
type Q = { quality: string; is_active: boolean; pack_price: string };
type Size = { id: number | null; label: string; size_value: string; unit: string; bottles_per_pack: string; note: string; image_url: string; sort_order: string; is_active: boolean; qualities: Q[] };

const blank = (n: number): Size => ({ id: null, label: '', size_value: '', unit: 'L', bottles_per_pack: '6', note: '', image_url: '/site/500ml.jpg', sort_order: String((n + 1)), is_active: true, qualities: QUALITIES.map(q => ({ quality: q, is_active: false, pack_price: '' })) });
const fromApi = (r: any): Size => ({
  id: r.id, label: r.label, size_value: r.size_value, unit: r.unit, bottles_per_pack: r.bottles_per_pack == null ? '' : String(r.bottles_per_pack), note: r.note || '', image_url: r.image_url || '', sort_order: String(r.sort_order), is_active: r.is_active,
  qualities: QUALITIES.map(q => { const x = r.qualities.find((y: any) => y.quality === q); return { quality: q, is_active: !!x?.is_active, pack_price: x?.pack_price == null ? '' : String(Number(x.pack_price)) }; }),
});

export default function WebsiteAdmin() {
  const sizes = useApi<{ rows: any[] }>('/api/admin/sizes'); const settings = useApi<any>('/api/admin/site-settings'); const toast = useToast();
  const [rows, setRows] = useState<Size[]>([]); const [busy, setBusy] = useState<string | null>(null);
  const [addr, setAddr] = useState(''); const [embed, setEmbed] = useState('');
  useEffect(() => { if (sizes.data) setRows(sizes.data.rows.map(fromApi)); }, [sizes.data]);
  useEffect(() => { if (settings.data) { setAddr(settings.data.address || ''); setEmbed(settings.data.map_embed || ''); } }, [settings.data]);
  const edit = (i: number, patch: Partial<Size>) => setRows(rs => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const editQ = (i: number, qi: number, patch: Partial<Q>) => setRows(rs => rs.map((r, j) => (j === i ? { ...r, qualities: r.qualities.map((q, k) => (k === qi ? { ...q, ...patch } : q)) } : r)));

  async function save(i: number) {
    const r = rows[i]; setBusy(String(i));
    const json = { label: r.label, size_value: r.size_value, unit: r.unit, bottles_per_pack: r.bottles_per_pack.trim(), note: r.note, image_url: r.image_url, sort_order: r.sort_order, is_active: r.is_active,
      qualities: r.qualities.map(q => ({ quality: q.quality, is_active: q.is_active, pack_price: q.pack_price.trim() })) };
    try {
      if (r.id) await api(`/api/admin/sizes/${r.id}`, { method: 'PUT', json }); else await api('/api/admin/sizes', { method: 'POST', json });
      toast.success('Saved — the website is updated'); sizes.refetch();
    } catch (x: any) { toast.error(x.message); }
    setBusy(null);
  }
  async function remove(i: number) {
    const r = rows[i];
    if (!r.id) return setRows(rs => rs.filter((_, j) => j !== i));
    if (!confirm(`Delete “${r.label}” and all its qualities? (To hide it temporarily, untick “Show on website” instead.)`)) return;
    try { await api(`/api/admin/sizes/${r.id}`, { method: 'DELETE' }); toast.success('Deleted'); sizes.refetch(); } catch (x: any) { toast.error(x.message); }
  }
  async function saveSettings(e: React.FormEvent) {
    e.preventDefault(); setBusy('settings');
    try { const s = await api('/api/admin/site-settings', { method: 'PUT', json: { address: addr, map_embed: embed } }); setEmbed(s.map_embed); toast.success('Saved'); } catch (x: any) { toast.error(x.message); }
    setBusy(null);
  }

  return (
    <>
      <PageHeader title="Website" subtitle="Bottle sizes, qualities and prices shown on the public homepage. Changes appear on the website immediately." actions={<a className="btn" href="/" target="_blank" rel="noopener">View website</a>} />
      {sizes.loading && !sizes.data ? <div className="card"><LoadingState /></div> : sizes.error ? <div className="card"><ErrorState message={sizes.error} onRetry={sizes.refetch} /></div> : (
        <div className="stack">
          {rows.map((r, i) => (
            <div className="card card-pad stack" key={r.id ?? `new${i}`} style={{ opacity: r.is_active ? 1 : .75 }}>
              <div className="row between"><h2>{r.label || 'New size'}</h2>
                <label className="row small" style={{ gap: 6 }}><input type="checkbox" checked={r.is_active} onChange={e => edit(i, { is_active: e.target.checked })} /> Show on website</label></div>
              <div className="row" style={{ alignItems: 'flex-end', gap: 14 }}>
                <Field label="Tab name"><input className="input" style={{ width: 110 }} value={r.label} onChange={e => edit(i, { label: e.target.value })} placeholder="500 ml" /></Field>
                <Field label="Big number"><input className="input" style={{ width: 80 }} value={r.size_value} onChange={e => edit(i, { size_value: e.target.value })} placeholder="500" /></Field>
                <Field label="Unit"><select className="input" value={r.unit} onChange={e => edit(i, { unit: e.target.value })}><option value="ml">ml</option><option value="L">L</option></select></Field>
                <Field label="Bottles per pack" hint="Empty = sold individually"><input className="input" style={{ width: 110 }} inputMode="numeric" value={r.bottles_per_pack} onChange={e => edit(i, { bottles_per_pack: e.target.value })} /></Field>
                <Field label="Order"><input className="input" style={{ width: 70 }} inputMode="numeric" value={r.sort_order} onChange={e => edit(i, { sort_order: e.target.value })} /></Field>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ minWidth: 420 }}>
                  <thead><tr><th>Quality</th><th>Available</th><th>Price per pack (Rs)</th></tr></thead>
                  <tbody>{r.qualities.map((q, qi) => (
                    <tr key={q.quality}><td><b>{q.quality}</b></td>
                      <td><input type="checkbox" checked={q.is_active} onChange={e => editQ(i, qi, { is_active: e.target.checked })} aria-label={`${q.quality} available`} /></td>
                      <td><input className="input" style={{ width: 150 }} inputMode="decimal" value={q.pack_price} onChange={e => editQ(i, qi, { pack_price: e.target.value })} placeholder="Ask on WhatsApp" disabled={!q.is_active} aria-label={`${q.quality} price`} /></td></tr>))}</tbody>
                </table>
              </div>
              <p className="small muted">Untick “Available” when a quality is out of stock — it disappears from the website until you tick it again. Leave the price empty to show “Ask on WhatsApp”.</p>
              <div className="row" style={{ alignItems: 'flex-end' }}>
                <Field label="Note (optional)"><input className="input" style={{ minWidth: 300 }} value={r.note} onChange={e => edit(i, { note: e.target.value })} /></Field>
                <Field label="Image" hint="Path like /site/500ml.jpg or a https:// link"><input className="input" style={{ minWidth: 240 }} value={r.image_url} onChange={e => edit(i, { image_url: e.target.value })} /></Field>
              </div>
              <div className="row"><button className="btn btn-primary" disabled={busy === String(i)} onClick={() => save(i)}>{busy === String(i) ? 'Saving…' : 'Save this size'}</button><button className="btn" onClick={() => remove(i)}>Delete</button></div>
            </div>))}
          <div><button className="btn" onClick={() => setRows(rs => [...rs, blank(rs.length)])}>+ Add a bottle size</button></div>
        </div>)}

      <form className="card card-pad stack" style={{ marginTop: 18 }} onSubmit={saveSettings}>
        <h2>Location</h2>
        <Field label="Address (shown on the website)"><input className="input" value={addr} onChange={e => setAddr(e.target.value)} maxLength={300} placeholder="Leave empty to use the default address" /></Field>
        <Field label="Google Maps embed" hint="Google Maps → Share → Embed a map → copy HTML and paste it here. Leave empty to use the default map."><textarea className="input" rows={3} value={embed} onChange={e => setEmbed(e.target.value)} style={{ height: 'auto' }} placeholder='<iframe src="https://www.google.com/maps/embed?pb=…"></iframe>' /></Field>
        <div><button className="btn btn-primary" disabled={busy === 'settings'}>{busy === 'settings' ? 'Saving…' : 'Save location'}</button></div>
      </form>
    </>
  );
}
