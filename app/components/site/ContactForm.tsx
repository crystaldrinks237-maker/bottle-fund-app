'use client';
import React, { FormEvent, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2Icon, SendIcon } from 'lucide-react';
import { LiquidButton } from './LiquidButton';
import { api } from '@/lib/client';
import { WHATSAPP_DISPLAY } from '@/lib/site';

type Fields = { name: string; phone: string; message: string };
type Errors = Partial<Record<keyof Fields, string>>;
type Status = 'idle' | 'sending' | 'success' | 'error';
const empty: Fields = { name: '', phone: '', message: '' };

export function ContactForm() {
  const [fields, setFields] = useState<Fields>(empty);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<Status>('idle');
  const [serverError, setServerError] = useState('');
  const [trap, setTrap] = useState(''); // honeypot — real visitors never see or fill this

  const update = (key: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFields((f) => ({ ...f, [key]: e.target.value }));
    if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const nextErrors = validate(fields);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) { setStatus('idle'); return; }
    setStatus('sending'); setServerError('');
    try {
      await api('/api/public/contact', { method: 'POST', json: { ...fields, website: trap } });
      setStatus('success'); setFields(empty);
    } catch (x: any) { setServerError(x?.message || ''); setStatus('error'); }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="relative border border-white/10 bg-white/[0.03] p-6 backdrop-blur-sm md:p-10" aria-labelledby="form-title">
      <h3 id="form-title" className="font-serif text-3xl text-white">Send us a message</h3>
      <p className="mt-2 text-sm text-silver">Prefer a form? Leave your name and number and we will get back to you.</p>

      <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-2">
        <Field id="name" label="Your name" error={errors.name}>
          <input id="name" name="name" type="text" autoComplete="name" maxLength={80} value={fields.name} onChange={update('name')} aria-invalid={!!errors.name} aria-describedby={errors.name ? 'name-error' : undefined} className={inputClass(!!errors.name)} />
        </Field>
        <Field id="phone" label="Phone / WhatsApp number" error={errors.phone}>
          <input id="phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" maxLength={30} value={fields.phone} onChange={update('phone')} aria-invalid={!!errors.phone} aria-describedby={errors.phone ? 'phone-error' : undefined} className={inputClass(!!errors.phone)} />
        </Field>
        <Field id="message" label="What do you need?" error={errors.message} className="md:col-span-2">
          <textarea id="message" name="message" rows={4} maxLength={1500} value={fields.message} onChange={update('message')} placeholder="e.g. 20 packs of 500 ml bottles, delivery to…" aria-invalid={!!errors.message} aria-describedby={errors.message ? 'message-error' : undefined} className={`${inputClass(!!errors.message)} resize-none`} />
        </Field>
      </div>
      <input type="text" name="website" value={trap} onChange={(e) => setTrap(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 opacity-0" />

      <div className="mt-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <LiquidButton type="submit" disabled={status === 'sending'} icon={<SendIcon className="h-4 w-4" strokeWidth={1.5} />}>
          {status === 'sending' ? 'Sending…' : 'Send message'}
        </LiquidButton>
        <div aria-live="polite" className="min-h-[1.5rem]">
          <AnimatePresence>
            {status === 'success' &&
            <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex items-center gap-2 text-sm text-ice">
                <CheckCircle2Icon className="h-4 w-4" strokeWidth={1.5} /> Thank you — we've received your message and will contact you shortly.
              </motion.p>
            }
            {status === 'error' &&
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm text-danger">
                {serverError || "Couldn't send your message."} You can also message us on WhatsApp: {WHATSAPP_DISPLAY}.
              </motion.p>
            }
          </AnimatePresence>
        </div>
      </div>
    </form>);
}

function Field({ id, label, error, className = '', children }: { id: string; label: string; error?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="text-[11px] font-medium uppercase tracking-[0.2em] text-silver">{label}</label>
      {children}
      {error && <p id={`${id}-error`} className="mt-2 text-xs text-danger">{error}</p>}
    </div>);
}

function inputClass(hasError: boolean): string {
  return `mt-3 block w-full border-0 border-b bg-transparent px-0 pb-3 pt-1 text-base text-white placeholder:text-silver/40 transition-colors duration-200 ease-out focus:outline-none focus:ring-0 ${hasError ? 'border-danger' : 'border-white/20 hover:border-white/40 focus:border-ice'}`;
}

function validate(f: Fields): Errors {
  const errors: Errors = {};
  if (f.name.trim().length < 2) errors.name = 'Please enter your name.';
  const digits = f.phone.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15 || !/^[0-9+\-\s()]+$/.test(f.phone.trim())) errors.phone = 'Please enter a valid phone or WhatsApp number.';
  if (f.message.trim().length < 5) errors.message = 'Tell us what you need.';
  return errors;
}
