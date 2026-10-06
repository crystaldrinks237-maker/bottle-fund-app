import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { publicCalculator, publicNeeds } from '@/lib/services/public';
import { Calculator } from '@/components/landing/Calculator';
import { ProgressBar } from '@/components/ui/kit';
import { Stars } from '@/components/ui/Stars';
import { publicTestimonials } from '@/lib/services/testimonials';
import { formatMoney } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Fund bottle production. Get paid in 7 days.', description: 'Crystal Drinks funding platform — see open funding needs, calculate your profit, and invest or become a guarantor.' };

const STEPS = [
  ['Choose a funding need', 'Browse the production batches that are open right now and see the exact terms before you commit.'],
  ['Pay and upload proof', 'Send your amount to the payment account shown and upload the screenshot. We record the account exactly as you saw it.'],
  ['We verify — your clock starts', 'Once our team confirms your payment, a countdown of exactly 7 × 24 hours begins. You can watch it live.'],
  ['Get paid with a transaction ID', 'When the 7 days end, your principal plus profit is sent, and the transaction ID appears on your investment.'],
];
const FAQ = [
  ['When exactly do I get paid?', 'Exactly 7 days (168 hours) after your payment is verified — not after you send it. The countdown on your investment shows the precise second.'],
  ['How is my profit worked out?', 'Each funding need has a profit per bottle (selling price minus cost and operating cost). Your share of that profit is the investor percentage shown on the need, applied to the share of the batch your money funds. The calculator above does this for you.'],
  ['How do guarantors earn?', 'Anyone can be a guarantor — you get a personal referral link when you sign up. Anyone who joins through it is your referral. For each verified investment from someone they referred, the guarantor earns the guarantor percentage of that profit. Guarantor earnings are totalled monthly and paid once a month, with a transaction ID.'],
  ['Where do I send my money?', 'Only to the payment account shown to you inside your signed-in account on the funding need’s page. Never send money to an account someone gave you in a chat.'],
  ['What if a payment doesn’t arrive?', 'Every payout shows a transaction ID. If it hasn’t reached you, press “I did not receive this payment” and our team reviews it with you — the payment is never silently reversed.'],
  ['Can I see everything I’ve done?', 'Yes. Every investment has a timeline: submitted, verified, countdown, payout due, payout sent, completed — with your payment proof and the account you paid to.'],
];

export default async function Welcome() {
  const user = await getCurrentUser();
  if (user) redirect(user.roles.includes('ADMIN') ? '/admin' : user.roles.includes('INVESTOR') ? '/dashboard' : '/guarantor');
  const [needs, calc, reviews] = await Promise.all([publicNeeds(), publicCalculator(null, '50000', null), publicTestimonials()]);
  const ex = needs.find(n => n.status === 'OPEN' && Number(n.guarantor_pct) > 0) || needs.find(n => Number(n.guarantor_pct) > 0); // example only from a need that really pays guarantors
  return (
    <div className="land">
      <header className="land-nav">
        <Link href="/" className="land-brand"><Image src="/logo.png" alt="Crystal Drinks" width={44} height={47} priority /><span>Crystal Drinks</span></Link>
        <nav aria-label="Sections"><a href="#calculator">Calculator</a><a href="#how">How it works</a><a href="#needs">Open needs</a><a href="#guarantors">Guarantors</a>{reviews.rows.length > 0 && <a href="#reviews">Reviews</a>}<a href="#faq">FAQ</a></nav>
        <div className="row"><Link className="btn btn-sm" href="/login">Sign in</Link><Link className="btn btn-sm btn-primary" href="/signup">Create account</Link></div>
      </header>

      <section className="land-hero">
        <div className="land-wrap hero-grid">
          <div>
            <span className="eyebrow">Crystal Drinks funding</span>
            <h1>Fund real bottle production.<br />Get paid in exactly 7 days.</h1>
            <p className="lead">Pick an open funding need, see precisely what your money earns, and watch a live countdown from the moment we verify your payment. Every payout arrives with a transaction ID.</p>
            <div className="row" style={{ marginTop: 22 }}><Link className="btn btn-primary" style={{ height: 46, padding: '0 22px' }} href="/signup">Start investing</Link><a className="btn" style={{ height: 46 }} href="#guarantors">Earn as a guarantor</a></div>
            <ul className="hero-points"><li><b>7 × 24h</b> payout clock, timed to the second</li><li><b>Verified</b> payments — every one checked by our team</li><li><b>Transparent</b> — proof, account and timeline on every investment</li></ul>
          </div>
          <Calculator initial={calc} />
        </div>
        <svg className="hero-wave" viewBox="0 0 1440 120" preserveAspectRatio="none" aria-hidden="true"><path d="M0 70C200 20 380 120 620 80S1050 10 1250 60 1400 90 1440 70V120H0Z" fill="#fff" /></svg>
      </section>

      <section className="land-sec" id="how"><div className="land-wrap">
        <h2 className="sec-title">How it works</h2>
        <ol className="steps">{STEPS.map(([t, d], i) => <li key={t}><span className="num">{i + 1}</span><h3>{t}</h3><p>{d}</p></li>)}</ol>
      </div></section>

      <section className="land-sec alt" id="needs"><div className="land-wrap">
        <h2 className="sec-title">Open funding needs</h2><p className="sec-sub">Live from our system. Several can be open at once, each with its own terms.</p>
        {!needs.length ? <div className="card card-pad"><p className="muted">Nothing is open right now. Create an account and check back soon.</p></div> : (
          <div className="cards">{needs.map(n => (
            <div className="card need-card" key={n.id}>
              <div><h3>{n.title}</h3><div className="muted small">{n.product} · {Number(n.quantity).toLocaleString()} bottles</div></div>
              <ProgressBar funded={n.funded_amount} total={n.total_capital} />
              <div className="per100"><div className="small muted">Invest PKR 100,000 → after 7 days</div><div className="big">{formatMoney(n.per_100k.total_return)}</div><div className="small pos">profit {formatMoney(n.per_100k.investor_profit)} · {Number(n.investor_pct)}% investor share</div></div>
              <Link className={`btn ${n.status === 'OPEN' ? 'btn-primary' : ''}`} href="/signup">{n.status === 'OPEN' ? 'Invest in this need' : 'Fully funded'}</Link>
            </div>))}</div>)}
      </div></section>

      <section className="land-sec" id="guarantors"><div className="land-wrap guar-grid">
        <div>
          <span className="eyebrow">For guarantors</span>
          <h2 className="sec-title" style={{ textAlign: 'left' }}>Grow your earnings without adding your own funds</h2>
          <p className="lead" style={{ maxWidth: 520 }}>Everyone who joins gets a personal referral link. Share it with people you know — when they sign up and their investments are verified, you earn the guarantor share of the profit on each one. The more people you bring, the more you earn.</p>
          <ul className="ticks"><li>Sign up, copy your referral link, share it — that’s it, nothing to apply for</li><li>Earn the guarantor percentage on every verified investment from your referrals</li><li>Your dashboard shows each referral, each earning and each payment</li><li>Paid once a month, with a transaction ID — and you can report a payment that didn’t arrive</li></ul>
          <div className="row" style={{ marginTop: 18 }}><Link className="btn btn-primary" href="/signup">Create an account and get my link</Link></div>
        </div>
        {ex && (
          <div className="card card-pad guar-example"><div className="small muted" style={{ fontWeight: 700 }}>Example · {ex.title}</div>
            <div className="ex-row"><span>People you refer invest</span><b>{formatMoney('500000')}</b></div>
            <div className="ex-row"><span>Guarantor share</span><b>{Number(ex.guarantor_pct)}%</b></div>
            <div className="ex-total"><span>You earn</span><b>{formatMoney((Number(ex.per_100k.guarantor_profit) * 5).toFixed(2))}</b></div>
            <p className="small muted">Calculated at this need’s terms. Try your own numbers in the calculator above.</p></div>)}
      </div></section>

      {reviews.rows.length > 0 && (
        <section className="land-sec" id="reviews"><div className="land-wrap">
          <h2 className="sec-title">What our investors say</h2>
          {reviews.count >= 3 && <p className="sec-sub"><Stars value={Math.round(Number(reviews.average))} /> <b>{Number(reviews.average)}</b> average from {reviews.count} reviews</p>}
          <div className="testi-grid">{reviews.rows.map((r: any) => (
            <figure className="testi" key={r.id}>
              <Stars value={r.rating} />
              <blockquote>{r.body}</blockquote>
              <figcaption><b>{r.display_name}</b>{r.city ? <span className="muted">, {r.city}</span> : null}{r.verified && <span className="badge success" style={{ marginLeft: 8 }}>Verified investor</span>}</figcaption>
            </figure>))}</div>
          <p className="small muted" style={{ textAlign: 'center', marginTop: 18 }}>Reviews are written by Crystal Drinks customers who agreed to share them. “Verified investor” means they have received a payout through the platform.</p>
        </div></section>
      )}

      <section className="land-sec alt"><div className="land-wrap trust">
        <div><h3>Every payment verified</h3><p>Our team checks each payment against the proof you upload before your clock starts.</p></div>
        <div><h3>The clock is exact</h3><p>7 × 24 hours from verification, kept by our server — not your phone — so it’s the same everywhere.</p></div>
        <div><h3>Nothing rewritten later</h3><p>The account you paid and the terms you agreed are recorded at submission and never change.</p></div>
        <div><h3>A record of everything</h3><p>Timelines, transaction IDs and an activity log mean you can always see what happened.</p></div>
      </div></section>

      <section className="land-sec" id="faq"><div className="land-wrap" style={{ maxWidth: 820 }}>
        <h2 className="sec-title">Questions, answered</h2>
        {FAQ.map(([q, a]) => <details key={q} className="faq"><summary>{q}</summary><p>{a}</p></details>)}
      </div></section>

      <section className="land-cta"><div className="land-wrap"><h2>Ready to see your numbers?</h2><p>Create a free account — it takes a minute.</p>
        <div className="row" style={{ justifyContent: 'center', marginTop: 16 }}><Link className="btn btn-primary" style={{ height: 46, padding: '0 24px' }} href="/signup">Create account</Link><Link className="btn" style={{ height: 46 }} href="/login">Sign in</Link></div></div></section>

      <footer className="land-foot"><div className="land-wrap row between"><span>© {new Date().getFullYear()} Crystal Drinks</span><span className="small">All times shown in {process.env.NEXT_PUBLIC_APP_TIMEZONE || 'Asia/Karachi'} · <Link href="/login">Sign in</Link> · <Link href="/signup">Sign up</Link></span></div></footer>
    </div>
  );
}
