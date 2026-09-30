import { z } from 'zod';

export const idSchema = z.coerce.number().int().positive();
export const reasonSchema = z.string().trim().min(3, 'Please give a reason (at least 3 characters)').max(1000);
export const noteSchema = z.string().trim().max(2000).optional().nullable();
export const txnSchema = z.string().trim().min(3, 'Transaction ID is required').max(120).regex(/^[A-Za-z0-9\-_./ #]+$/, 'Transaction ID contains unsupported characters');
const dec = z.union([z.string(), z.number()]).transform(v => String(v).trim());

export const usernameSchema = z.string().trim().toLowerCase().min(3, 'At least 3 characters').max(32).regex(/^[a-z0-9._-]+$/, 'Use letters, numbers, dots, dashes or underscores');
export const passwordSchema = z.string().min(10, 'Password must be at least 10 characters').max(128);
export const phoneSchema = z.string().trim().max(24).regex(/^[0-9+\-\s()]*$/, 'Enter a valid phone number').optional().nullable();

export const needSchema = z.object({
  title: z.string().trim().min(2).max(120),
  product: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional().nullable(),
  quantity: z.coerce.number().int().positive().max(1_000_000_000),
  cost_price: dec, sell_price: dec, op_cost: dec.default('0'),
  investor_pct: dec.default('0'), guarantor_pct: dec.default('0'),
  account_ids: z.array(idSchema).max(20).optional(),
  open_now: z.boolean().optional(),
});

const provider = z.enum(['BANK', 'EASYPAISA', 'JAZZCASH', 'OTHER']);
export const accountSchema = z.object({
  account_name: z.string().trim().min(2).max(80),
  provider,
  bank_name: z.string().trim().max(80).optional().nullable(),
  account_holder_name: z.string().trim().min(2).max(120),
  account_number: z.string().trim().min(3).max(40),
  iban: z.string().trim().toUpperCase().max(40).optional().nullable(),
  instructions: z.string().trim().max(1000).optional().nullable(),
  daily_limit: dec.optional().nullable(),
  total_limit: dec.optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
}).superRefine((v, ctx) => {
  if (v.provider === 'BANK' && !v.bank_name) ctx.addIssue({ code: 'custom', path: ['bank_name'], message: 'Bank name is required for bank accounts' });
  if (v.iban && !/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(v.iban.replace(/\s/g, ''))) ctx.addIssue({ code: 'custom', path: ['iban'], message: 'Enter a valid IBAN' });
  if (v.provider !== 'BANK' && !/^[0-9+\-\s]{7,20}$/.test(v.account_number)) ctx.addIssue({ code: 'custom', path: ['account_number'], message: 'Enter the wallet mobile number' });
});
