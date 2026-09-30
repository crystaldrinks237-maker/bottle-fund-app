// Single place for app-wide constants. The timezone is explicit: the DB stores UTC (timestamptz),
// and every human-facing timestamp / month bucket is rendered in this zone.
export const APP_TIMEZONE = process.env.NEXT_PUBLIC_APP_TIMEZONE || process.env.APP_TIMEZONE || 'Asia/Karachi';
export const CURRENCY = 'PKR';
// The payout cycle is exactly 168 hours (7 × 24h) from verification — never calendar-day arithmetic.
export const PAYOUT_CYCLE_HOURS = 168;
export const MAX_PROOF_BYTES = 4 * 1024 * 1024; // Vercel request bodies are capped at ~4.5 MB
export const ALLOWED_PROOF_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const ROLES = ['ADMIN', 'INVESTOR', 'GUARANTOR'] as const;
export type Role = (typeof ROLES)[number];
