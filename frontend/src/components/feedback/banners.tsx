import { type ReactNode } from 'react';
import { CloudOff, FlaskConical } from 'lucide-react';
import { cn } from '@/lib/cn';
import { SHOW_PROTOTYPE_BANNER } from '@/lib/api/config';
import { useOnlineStatus } from '@/lib/hooks/use-online-status';

export function OfflineBanner({ className }: { className?: string }) {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div
      role="status"
      className={cn(
        'flex items-center gap-3 border-b border-warning/25 bg-warning-surface px-4 py-2.5 text-sm text-warning',
        className,
      )}
    >
      <CloudOff aria-hidden="true" className="size-4 shrink-0" />
      <p className="font-medium">
        You are offline. Your last local changes are preserved and will sync when you reconnect.
      </p>
    </div>
  );
}

/**
 * Prototype banner.
 *
 * While the app runs against fixtures, this states so plainly. A judge must
 * never mistake a prototype screen for a working product.
 */
export function PrototypeBanner({ className }: { className?: string }) {
  if (!SHOW_PROTOTYPE_BANNER) return null;

  return (
    <div
      role="status"
      className={cn(
        'flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-primary/20 bg-primary/8 px-4 py-2 text-meta text-primary',
        className,
      )}
    >
      <FlaskConical aria-hidden="true" className="size-3.5 shrink-0" />
      <span className="font-semibold">Prototype data</span>
      <span className="hidden text-primary/80 sm:inline">
        — the backend is not connected yet. Names, programmes and sources below are synthetic
        fixtures.
      </span>
      <span className="text-primary/80 sm:hidden">— backend not connected</span>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  className,
  children,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <header
      className={cn('flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between', className)}
    >
      <div className="flex flex-col gap-1.5">
        <h1 className="text-page-title font-semibold tracking-tight text-text">{title}</h1>
        {description ? <p className="max-w-2xl text-sm text-text-muted">{description}</p> : null}
        {children}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
