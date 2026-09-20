import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastApi {
  notify: (message: string, variant?: ToastVariant) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | undefined>(undefined);

const VARIANTS: Record<ToastVariant, { icon: typeof Info; wrapper: string; iconColor: string }> = {
  success: { icon: CheckCircle2, wrapper: 'border-emerald-200 bg-emerald-50 text-emerald-900', iconColor: 'text-emerald-600' },
  error: { icon: XCircle, wrapper: 'border-red-200 bg-red-50 text-red-900', iconColor: 'text-red-600' },
  warning: { icon: AlertTriangle, wrapper: 'border-amber-200 bg-amber-50 text-amber-900', iconColor: 'text-amber-600' },
  info: { icon: Info, wrapper: 'border-primary-200 bg-primary-50 text-primary-900', iconColor: 'text-primary-600' },
};

const AUTO_DISMISS_MS = 5000;

/**
 * Provedor de avisos não bloqueantes. Substitui os `alert()` espalhados pelas
 * páginas, que travavam a aba e não davam contexto sobre a falha.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef<number[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (message: string, variant: ToastVariant = 'info') => {
      const id = nextId.current++;
      setToasts((current) => [...current.slice(-3), { id, message, variant }]);
      const timer = window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
      timers.current.push(timer);
    },
    [dismiss],
  );

  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  const api = useMemo<ToastApi>(
    () => ({
      notify,
      success: (message: string) => notify(message, 'success'),
      error: (message: string) => notify(message, 'error'),
      warning: (message: string) => notify(message, 'warning'),
      info: (message: string) => notify(message, 'info'),
    }),
    [notify],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="fixed bottom-4 right-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
        role="region"
        aria-label="Notificações do sistema"
      >
        {toasts.map((toast) => {
          const { icon: Icon, wrapper, iconColor } = VARIANTS[toast.variant];
          return (
            <div
              key={toast.id}
              role="status"
              aria-live="polite"
              className={`flex items-start gap-3 rounded-xl border p-4 shadow-lg backdrop-blur ${wrapper}`}
            >
              <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconColor}`} aria-hidden="true" />
              <p className="flex-1 text-sm font-medium">{toast.message}</p>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="rounded p-1 opacity-60 transition hover:opacity-100"
                aria-label="Fechar aviso"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast deve ser usado dentro de ToastProvider');
  return context;
}
