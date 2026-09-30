// Decimal-safe money & percentage arithmetic. Money is held as BIGINT paise (1 PKR = 100),
// percentages as basis points (1% = 100). No floating point is ever used for authoritative figures.
export class MoneyError extends Error {}

const DEC2 = /^-?\d+(\.\d{1,2})?$/;

export function toPaisa(v: string | number | bigint | null | undefined): bigint {
  if (typeof v === 'bigint') return v;
  const s = typeof v === 'number' ? (Number.isFinite(v) ? String(v) : '') : String(v ?? '').trim();
  if (!DEC2.test(s)) throw new MoneyError(`"${s}" is not a valid amount (max 2 decimal places)`);
  const neg = s.startsWith('-');
  const [w, f = ''] = s.replace('-', '').split('.');
  const n = BigInt(w) * 100n + BigInt((f + '00').slice(0, 2));
  return neg ? -n : n;
}
export const toBp = toPaisa; // "12.5" -> 1250 bp (same 2dp fixed-point shape)

export function fromPaisa(p: bigint): string {
  const neg = p < 0n; const a = neg ? -p : p;
  return `${neg ? '-' : ''}${a / 100n}.${String(a % 100n).padStart(2, '0')}`;
}
export const fromBp = fromPaisa;

/** Integer division rounding half away from zero. */
export function divRound(n: bigint, d: bigint): bigint {
  if (d === 0n) throw new MoneyError('Division by zero');
  const neg = (n < 0n) !== (d < 0n);
  const an = n < 0n ? -n : n; const ad = d < 0n ? -d : d;
  const q = (an * 2n + ad) / (ad * 2n);
  return neg ? -q : q;
}
