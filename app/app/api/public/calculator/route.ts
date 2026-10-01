import { NextResponse } from 'next/server';
import { ApiError } from '@/lib/api';
import { publicCalculator } from '@/lib/services/public';

export const dynamic = 'force-dynamic'; // computed per request — never frozen at build time

// Public (no login): read-only, validated, and exposes only profit shares and computed results — never prices or margins.
export async function GET(req: Request) {
  try {
    const p = new URL(req.url).searchParams;
    const out = await publicCalculator(p.get('need_id'), p.get('amount'), p.get('referred'));
    return NextResponse.json(out, { headers: { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30' } });
  } catch (e: any) {
    if (e instanceof ApiError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error('[public calculator]', e);
    return NextResponse.json({ error: 'The calculator is temporarily unavailable.' }, { status: 500 });
  }
}
