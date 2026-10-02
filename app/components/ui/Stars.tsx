/** Read-only star rating (server- and client-safe). */
export function Stars({ value, size = 18 }: { value: number; size?: number }) {
  return (
    <span className="stars" role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map(i => (
        <svg key={i} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className={i <= value ? 'on' : ''}><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" /></svg>
      ))}
    </span>
  );
}
