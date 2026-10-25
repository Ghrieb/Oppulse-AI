import * as ToastPrimitive from '@radix-ui/react-toast';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import {
  ToastContext,
  type ToastContextValue,
  type ToastOptions,
  type ToastTone,
} from '@/lib/hooks/use-toast';

/**
 * Toast region.
 *
 * A single polite live region at the root announces new toasts. Toasts
 * confirm low-risk background results only — they never carry the only copy
 * of an important error (spec §5.4).
 */

interface ToastEntry extends ToastOptions {
  id: string;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((entry) => entry.id !== id));
  }, []);

  const toast = useCallback(
    (options: ToastOptions) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const duration = options.duration ?? (options.tone === 'error' ? 9000 : 5000);
      setToasts((current) => [...current, { ...options, id }]);
      window.setTimeout(() => dismiss(id), duration);
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      <ToastPrimitive.Provider swipeDirection="right" duration={5000}>
        {children}
        {toasts.map((entry) => (
          <ToastPrimitive.Root
            key={entry.id}
            duration={entry.duration ?? 5000}
            onOpenChange={(open) => {
              if (!open) dismiss(entry.id);
            }}
            className={cn(
              'rounded-card border bg-surface p-4 shadow-popover',
              'data-[state=open]:animate-in data-[state=open]:slide-in-from-right-4',
              entry.tone === 'error' && 'border-danger/30',
              entry.tone === 'success' && 'border-success/30',
              entry.tone === 'warning' && 'border-warning/30',
              (!entry.tone || entry.tone === 'info') && 'border-border',
            )}
          >
            <div className="flex items-start gap-3">
              <ToastIcon tone={entry.tone ?? 'info'} />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <ToastPrimitive.Title className="text-sm font-semibold text-text">
                  {entry.title}
                </ToastPrimitive.Title>
                {entry.description ? (
                  <ToastPrimitive.Description className="text-sm text-text-muted">
                    {entry.description}
                  </ToastPrimitive.Description>
                ) : null}
                {entry.action ? (
                  <button
                    type="button"
                    onClick={() => {
                      entry.action?.onClick();
                      dismiss(entry.id);
                    }}
                    className="mt-1 self-start text-sm font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                  >
                    {entry.action.label}
                  </button>
                ) : null}
              </div>
              <ToastPrimitive.Close className="grid size-8 shrink-0 place-items-center rounded-button text-text-muted hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring">
                <X aria-hidden="true" className="size-4" />
                <span className="sr-only">Dismiss</span>
              </ToastPrimitive.Close>
            </div>
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport className="fixed right-0 bottom-0 z-[60] flex max-h-screen w-full max-w-sm flex-col gap-2 p-4" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}

function ToastIcon({ tone }: { tone: ToastTone }) {
  const iconClass = 'mt-0.5 size-5 shrink-0';
  switch (tone) {
    case 'success':
      return <CheckCircle2 aria-hidden="true" className={cn(iconClass, 'text-success')} />;
    case 'warning':
      return <AlertTriangle aria-hidden="true" className={cn(iconClass, 'text-warning')} />;
    case 'error':
      return <XCircle aria-hidden="true" className={cn(iconClass, 'text-danger')} />;
    default:
      return <Info aria-hidden="true" className={cn(iconClass, 'text-info')} />;
  }
}
