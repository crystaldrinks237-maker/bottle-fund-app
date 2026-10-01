import Image from 'next/image';
import Link from 'next/link';

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="auth">
      <div className="auth-form">
        <Link href="/" aria-label="Crystal Drinks home"><Image src="/logo.png" alt="Crystal Drinks" width={116} height={124} className="logo" priority /></Link>
        <h1>{title}</h1>
        <p className="muted" style={{ margin: '6px 0 24px' }}>{subtitle}</p>
        {children}
      </div>
      <aside className="auth-side" aria-hidden="true">
        <svg className="wave" viewBox="0 0 800 400" preserveAspectRatio="none"><path d="M0 250C140 190 260 300 420 250S680 150 800 210V0H0Z" fill="#219ECE" opacity=".35" /><path d="M0 170C160 110 280 230 440 180S690 90 800 140V0H0Z" fill="#6FA847" opacity=".28" /></svg>
        <h2>Fund production. Track every rupee.</h2>
        <p>Crystal Drinks funds bottle production through verified investors and guarantors, with every payment recorded and every payout timed to the second.</p>
        <ul>
          <li><i />Payments are verified by our team before your cycle begins.</li>
          <li><i />Each payout is due exactly 7 days (168 hours) after verification.</li>
          <li><i />Every payout arrives with a transaction ID you can check.</li>
        </ul>
      </aside>
    </div>
  );
}
