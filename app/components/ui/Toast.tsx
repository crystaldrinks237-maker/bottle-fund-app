'use client';
import { createContext, useCallback, useContext, useState } from 'react';
import { Icon } from './Icon';

type T = { id: number; kind: 'success' | 'error' | 'info'; text: string };
const Ctx = createContext<{ push: (kind: T['kind'], text: string) => void }>({ push: () => {} });
export const useToast = () => {
  const { push } = useContext(Ctx);
  return { success: (m: string) => push('success', m), error: (m: string) => push('error', m), info: (m: string) => push('info', m) };
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<T[]>([]);
  const push = useCallback((kind: T['kind'], text: string) => {
    const id = Date.now() + Math.random();
    setItems(s => [...s, { id, kind, text }]);
    setTimeout(() => setItems(s => s.filter(x => x.id !== id)), kind === 'error' ? 7000 : 4200);
  }, []);
  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map(t => (
          <div key={t.id} className={`toast ${t.kind}`}>
            <Icon name={t.kind === 'error' ? 'alert' : 'check'} size={18} /> <span>{t.text}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
