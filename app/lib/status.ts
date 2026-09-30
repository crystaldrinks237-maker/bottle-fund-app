export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'violet';
const M: Record<string, [string, Tone]> = {
  // funding needs
  DRAFT: ['Draft', 'neutral'], OPEN: ['Open', 'success'], FULL: ['Fully funded', 'info'], CLOSED: ['Closed', 'neutral'], COMPLETED: ['Completed', 'success'], CANCELLED: ['Cancelled', 'danger'],
  // investments
  PENDING_VERIFICATION: ['Awaiting verification', 'warning'], VERIFIED: ['Verified · countdown', 'info'], PAYOUT_DUE: ['Payout due', 'warning'], REJECTED: ['Rejected', 'danger'],
  // payouts / guarantor payments
  SCHEDULED: ['Scheduled', 'info'], DUE: ['Due', 'warning'], PENDING: ['Pending', 'warning'], PROCESSING: ['Processing', 'violet'], PAID: ['Paid', 'success'],
  CLAIMED_NOT_RECEIVED: ['Reported not received', 'danger'], RESOLVED: ['Resolved', 'success'],
  // claims
  UNDER_REVIEW: ['Under review', 'violet'],
  // accounts
  ACTIVE: ['Active', 'success'], INACTIVE: ['Inactive', 'neutral'], NEAR_LIMIT: ['Near limit', 'warning'], LIMIT_REACHED: ['Limit reached', 'danger'], DAILY_LIMIT_REACHED: ['Daily limit reached', 'danger'],
};
export const statusMeta = (s: string): [string, Tone] => M[s] || [s.toLowerCase().replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase()), 'neutral'];
export const OVERRIDE_CLAIM_OPEN: Tone = 'danger';
