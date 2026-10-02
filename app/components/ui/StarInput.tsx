'use client';
import { useState } from 'react';

export function StarInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="stars star-input" role="radiogroup" aria-label="Star rating">
      {[1, 2, 3, 4, 5].map(i => (
        <button type="button" key={i} role="radio" aria-checked={value === i} aria-label={`${i} star${i > 1 ? 's' : ''}`} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(0)} onClick={() => onChange(i)}>
          <svg viewBox="0 0 24 24" width="30" height="30" className={i <= (hover || value) ? 'on' : ''}><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" /></svg>
        </button>
      ))}
    </div>
  );
}
