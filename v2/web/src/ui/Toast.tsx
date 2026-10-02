import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';

type Tone = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  tone: Tone;
  title: string;
  message?: string;
}

interface ToastApi {
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const Ctx = createContext<ToastApi | null>(null);
let seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const remove = useCallback((id: number) => setItems((l) => l.filter((t) => t.id !== id)), []);
  const push = useCallback(
    (tone: Tone, title: string, message?: string) => {
      const id = ++seq;
      setItems((l) => [...l.slice(-3), { id, tone, title, message }]);
      setTimeout(() => remove(id), tone === 'error' ? 8000 : 4500);
    },
    [remove],
  );
  const api = useMemo<ToastApi>(
    () => ({ success: (t, m) => push('success', t, m), error: (t, m) => push('error', t, m), info: (t, m) => push('info', t, m) }),
    [push],
  );
  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="ev-toasts" aria-live="polite">
        {items.map((t) => {
          const Icon = t.tone === 'success' ? CheckCircle2 : t.tone === 'error' ? XCircle : Info;
          return (
            <div key={t.id} className="ev-toast" data-tone={t.tone} role={t.tone === 'error' ? 'alert' : 'status'}>
              <Icon aria-hidden="true" />
              <div>
                <strong>{t.title}</strong>
                {t.message && <p>{t.message}</p>}
              </div>
              <button className="ev-icon-btn ev-icon-btn--sm" aria-label="Fermer" onClick={() => remove(t.id)}>
                <X />
              </button>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast hors ToastProvider');
  return ctx;
}
