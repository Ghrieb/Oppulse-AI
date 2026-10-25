import type { ReactNode } from 'react';
import {
  AlertTriangle,
  CloudOff,
  FileQuestion,
  Hourglass,
  Lock,
  RefreshCw,
  ServerCrash,
  Unlink,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { ApiError } from '@/lib/api/errors';
import { useOnlineStatus } from '@/lib/hooks/use-online-status';
import { TechnicalDetailsButton } from './technical-details';

/**
 * System feedback states.
 *
 * Every network-backed panel has its own state rather than one generic
 * failure: the copy follows the error matrix (spec §A.2) — say what
 * happened, say whether the student's work was preserved, and say what to
 * do next (spec §7.1). Codes with a distinct state render it from
 * `ErrorState`; the rest keep the generic card below.
 */

export interface EmptyStateProps {
  icon?: ReactNode | undefined;
  title: string;
  description: ReactNode;
  action?: ReactNode | undefined;
  className?: string | undefined;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-card border border-dashed border-border bg-surface px-6 py-12 text-center',
        className,
      )}
    >
      {icon ? (
        <span aria-hidden="true" className="rounded-full bg-surface-subtle p-3 text-text-muted">
          {icon}
        </span>
      ) : null}
      <h3 className="text-card-title font-semibold text-text">{title}</h3>
      <p className="max-w-md text-sm text-text-muted">{description}</p>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

/** One alert card, tinted by how bad the situation is. */
type Tone = 'danger' | 'warning';

const TONE_CLASSES: Record<Tone, string> = {
  danger: 'border-danger/25 bg-danger-surface',
  warning: 'border-warning/30 bg-warning-surface',
};

const TONE_ICON: Record<Tone, string> = {
  danger: 'text-danger',
  warning: 'text-warning',
};

interface AlertCardProps {
  tone: Tone;
  icon: ReactNode;
  title: string;
  message: ReactNode;
  error?: ApiError | undefined;
  runId?: string | undefined;
  action?: ReactNode | undefined;
  children?: ReactNode | undefined;
  className?: string | undefined;
}

function AlertCard({
  tone,
  icon,
  title,
  message,
  error,
  runId,
  action,
  children,
  className,
}: AlertCardProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-start gap-3 rounded-card px-5 py-4',
        TONE_CLASSES[tone],
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className={cn('mt-0.5 size-5 shrink-0', TONE_ICON[tone])}>
          {icon}
        </span>
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold text-text">{title}</h3>
          <p className="text-sm text-text-muted">{message}</p>
          {error?.requestId ? (
            <p className="text-meta text-text-muted">
              Reference: <code className="font-mono">{error.requestId}</code>
            </p>
          ) : null}
        </div>
      </div>
      {action ? <div className="flex flex-wrap gap-2">{action}</div> : null}
      {children}
      {error ? <TechnicalDetailsButton error={error} runId={runId} /> : null}
    </div>
  );
}

export interface ErrorStateProps {
  title?: string | undefined;
  /** Overrides the fallback copy. Codes with a distinct state ignore it. */
  message?: ReactNode | undefined;
  error?: unknown;
  onRetry?: (() => void) | undefined;
  /** The run this failure belongs to, where the caller knows it. */
  runId?: string | undefined;
  className?: string | undefined;
}

/**
 * Renders a failure with its own state and a recovery path.
 *
 * A code with a distinct state (offline, rate limited, provider outage,
 * session expired, contract mismatch) renders that state with the error
 * matrix's wording; anything else falls back to the generic card, whose
 * copy is derived from the code so a missing record does not read like a
 * server fault.
 */
export function ErrorState({ title, message, error, onRetry, runId, className }: ErrorStateProps) {
  const apiError = error instanceof ApiError ? error : null;
  const distinct = apiError ? distinctStateFor(apiError, { onRetry, runId, className }) : null;
  if (distinct) return distinct;

  return (
    <AlertCard
      tone="danger"
      icon={<AlertTriangle aria-hidden="true" />}
      title={title ?? defaultTitle(apiError)}
      message={message ?? defaultMessage(apiError)}
      error={apiError ?? undefined}
      runId={runId}
      action={
        onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw aria-hidden="true" className="size-4" />
            Try again
          </Button>
        ) : undefined
      }
      className={className}
    />
  );
}

interface DistinctOptions {
  onRetry?: (() => void) | undefined;
  runId?: string | undefined;
  className?: string | undefined;
}

function distinctStateFor(error: ApiError, options: DistinctOptions): ReactNode | null {
  switch (error.code) {
    case 'NETWORK':
      return <OfflineState error={error} {...options} />;
    case 'RATE_LIMITED':
      return <RateLimitedState error={error} {...options} />;
    case 'PROVIDER_UNAVAILABLE':
      return <ProviderUnavailableState error={error} {...options} />;
    case 'UNAUTHORIZED':
      return <SessionExpiredState error={error} {...options} />;
    case 'CONTRACT_MISMATCH':
      return <ContractMismatchState error={error} {...options} />;
    default:
      return null;
  }
}

export interface OfflineStateProps {
  error?: ApiError | undefined;
  onRetry?: (() => void) | undefined;
  className?: string | undefined;
}

/** Offline: the work is preserved, and the retry waits for the connection. */
export function OfflineState({ error, onRetry, className }: OfflineStateProps) {
  const online = useOnlineStatus();

  return (
    <AlertCard
      tone="warning"
      icon={<CloudOff aria-hidden="true" />}
      title="You're offline"
      message="Your last local changes are preserved."
      error={error}
      action={
        onRetry ? (
          <>
            <Button variant="outline" size="sm" onClick={onRetry} disabled={!online}>
              <RefreshCw aria-hidden="true" className="size-4" />
              Try again
            </Button>
            {!online ? (
              <span className="self-center text-meta text-text-muted">
                The retry is available again once you reconnect.
              </span>
            ) : null}
          </>
        ) : undefined
      }
      className={className}
    />
  );
}

export interface RateLimitedStateProps {
  error?: ApiError | undefined;
  onRetry?: (() => void) | undefined;
  className?: string | undefined;
}

/** Rate limited: a moment, not a failure — the retry is bounded already. */
export function RateLimitedState({ error, onRetry, className }: RateLimitedStateProps) {
  return (
    <AlertCard
      tone="warning"
      icon={<Hourglass aria-hidden="true" />}
      title="Research is paused briefly"
      message="The service needs a moment before trying again."
      error={error}
      action={
        onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw aria-hidden="true" className="size-4" />
            Try again
          </Button>
        ) : undefined
      }
      className={className}
    />
  );
}

export interface ProviderUnavailableStateProps {
  error?: ApiError | undefined;
  onRetry?: (() => void) | undefined;
  className?: string | undefined;
}

/** The provider is down; the student's saved work is not. */
export function ProviderUnavailableState({
  error,
  onRetry,
  className,
}: ProviderUnavailableStateProps) {
  return (
    <AlertCard
      tone="warning"
      icon={<ServerCrash aria-hidden="true" />}
      title="The AI provider is temporarily unavailable"
      message="Your mission is saved; retry the analysis."
      error={error}
      action={
        onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw aria-hidden="true" className="size-4" />
            Retry analysis
          </Button>
        ) : undefined
      }
      className={className}
    />
  );
}

export interface SessionExpiredStateProps {
  error?: ApiError | undefined;
  className?: string | undefined;
}

/** Session expired: sign in again, and come back to the same place. */
export function SessionExpiredState({ error, className }: SessionExpiredStateProps) {
  const location = useLocation();
  const next = `${location.pathname}${location.search}`;

  return (
    <AlertCard
      tone="warning"
      icon={<Lock aria-hidden="true" />}
      title="Your session has expired"
      message="Sign in again and we will return you to where you were."
      error={error}
      action={
        <Button asChild variant="outline" size="sm">
          <a href={`/auth/sign-in?next=${encodeURIComponent(next)}`}>Sign in again</a>
        </Button>
      }
      className={className}
    />
  );
}

export interface ContractMismatchStateProps {
  error?: ApiError | undefined;
  onRetry?: (() => void) | undefined;
  className?: string | undefined;
}

/**
 * The response did not match the contract.
 *
 * A bug in the backend or a stale frontend — the reference is shown, and
 * no partial data is rendered (spec §A.2).
 */
export function ContractMismatchState({ error, onRetry, className }: ContractMismatchStateProps) {
  return (
    <AlertCard
      tone="danger"
      icon={<AlertTriangle aria-hidden="true" />}
      title="Oppulse received an unexpected response"
      message="Nothing partial was rendered. Report the reference below so it can be fixed."
      error={error}
      action={
        onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw aria-hidden="true" className="size-4" />
            Try again
          </Button>
        ) : undefined
      }
      className={className}
    />
  );
}

export interface PartialStateProps {
  icon?: ReactNode | undefined;
  title?: string | undefined;
  description: ReactNode;
  action?: ReactNode | undefined;
  className?: string | undefined;
}

/**
 * Partial data: the request succeeded but some of it could not be read.
 *
 * This is not an error card — the student keeps what was extracted and
 * sees exactly what is missing (spec §A.2, partial extraction).
 */
export function PartialState({ icon, title, description, action, className }: PartialStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-start gap-3 rounded-card border border-warning/30 bg-warning-surface px-5 py-4',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-warning">
          {icon ?? <AlertTriangle />}
        </span>
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold text-text">
            {title ?? 'Some sections could not be read'}
          </h3>
          <div className="text-sm text-text-muted">{description}</div>
        </div>
      </div>
      {action ? <div className="flex flex-wrap gap-2">{action}</div> : null}
    </div>
  );
}

export interface SourceUnavailableStateProps {
  sourceUrl?: string | undefined;
  sourceTitle?: string | undefined;
  onRetry?: (() => void) | undefined;
  className?: string | undefined;
}

/**
 * A source we could not open.
 *
 * It stays visible as unreachable evidence — never converted into an
 * empty result (spec §A.1).
 */
export function SourceUnavailableState({
  sourceUrl,
  sourceTitle,
  onRetry,
  className,
}: SourceUnavailableStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-start gap-3 rounded-card border border-warning/30 bg-warning-surface px-4 py-3',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <Unlink aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold text-text">We could not open this source</h3>
          <p className="text-sm text-text-muted">
            The source could not be reached. This does not mean no opportunity exists.
          </p>
          {sourceTitle ? <p className="text-meta text-text-muted">{sourceTitle}</p> : null}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw aria-hidden="true" className="size-4" />
            Try again
          </Button>
        ) : null}
        {sourceUrl ? (
          <Button asChild variant="ghost" size="sm">
            <a href={sourceUrl} target="_blank" rel="noreferrer noopener">
              Open source
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export interface RefreshingIndicatorProps {
  className?: string | undefined;
}

/**
 * Stale data with a visible status.
 *
 * The panel keeps showing what it already has and says it is checking for
 * more, instead of blanking out (spec §5.5, refreshing).
 */
export function RefreshingIndicator({ className }: RefreshingIndicatorProps) {
  return (
    <span
      role="status"
      className={cn('inline-flex items-center gap-1.5 text-meta text-text-muted', className)}
    >
      <RefreshCw aria-hidden="true" className="size-3.5 animate-spin" />
      Refreshing…
    </span>
  );
}

export function PermissionState({ className }: { className?: string }) {
  return (
    <EmptyState
      className={className}
      icon={<Lock className="size-5" />}
      title="You do not have access to this item"
      description="Head back to your workspace to pick up where you left off."
      action={
        <Button asChild variant="outline" size="sm">
          <a href="/home">Back to workspace</a>
        </Button>
      }
    />
  );
}

export function NotFoundState({ className }: { className?: string }) {
  return (
    <EmptyState
      className={className}
      icon={<FileQuestion className="size-5" />}
      title="We could not find that"
      description="It may have been deleted, or the link may be out of date."
      action={
        <Button asChild variant="outline" size="sm">
          <a href="/home">Back to workspace</a>
        </Button>
      }
    />
  );
}

function defaultTitle(error: ApiError | null): string {
  switch (error?.code) {
    case 'TIMEOUT':
      return 'The request took too long';
    case 'FORBIDDEN':
      return 'You do not have access to this item';
    case 'NOT_FOUND':
      return 'We could not find that item';
    case 'VALIDATION':
      return 'Some details need attention';
    case 'CONFLICT':
      return 'This changed in another tab or session';
    default:
      return 'Something went wrong';
  }
}

function defaultMessage(error: ApiError | null): ReactNode {
  switch (error?.code) {
    case 'TIMEOUT':
      return 'Nothing was lost. The request was stopped before it completed.';
    case 'FORBIDDEN':
      return 'Head back to your workspace to pick up where you left off.';
    case 'NOT_FOUND':
      return 'It may have been deleted, or the link may be out of date.';
    case 'VALIDATION':
      return 'Check the highlighted fields. Your other answers are kept.';
    case 'CONFLICT':
      return 'Review the latest version before saving again, so nothing is overwritten silently.';
    default:
      return 'Nothing was lost. Try again, and if it keeps happening we will need the reference number above.';
  }
}
