import { createContext, useContext } from 'react';

/**
 * Toast API.
 *
 * The context lives here rather than in the provider component so that the
 * provider file only exports components (React Fast Refresh requires it)
 * and so hooks can be imported without pulling in the whole UI tree.
 */

export type ToastTone = 'info' | 'success' | 'warning' | 'error';

export interface ToastOptions {
  title: string;
  description?: string | undefined;
  tone?: ToastTone | undefined;
  /** A recovery action, e.g. "Retry". */
  action?: { label: string; onClick: () => void } | undefined;
  /** Milliseconds before auto-dismiss. Errors stay longer. */
  duration?: number | undefined;
}

export interface ToastContextValue {
  toast: (options: ToastOptions) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

/** Access the toast API. Must be used inside `<ToastProvider>`. */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used inside <ToastProvider>.');
  }
  return context;
}
