'use client';
export default function SectionError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card card-pad" style={{ maxWidth: 560 }} role="alert">
      <h2>This page hit a problem</h2>
      <p className="muted" style={{ margin: '8px 0 14px' }}>Nothing was lost — your data is safe. Try again, or open another section from the menu.{error.digest ? ` (ref ${error.digest})` : ''}</p>
      <button className="btn btn-primary" onClick={reset}>Try again</button>
    </div>
  );
}
