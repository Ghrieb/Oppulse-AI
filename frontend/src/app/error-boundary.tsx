import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertOctagon, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { logger } from '@/lib/logger';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Rendered instead of the children when an error is caught. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
  /** Changing this value resets the boundary — e.g. the current route. */
  resetKeys?: unknown[];
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Error boundary.
 *
 * A crash in one panel must not white-screen the whole workspace, so the
 * boundary is used both at the root and around individual regions.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    logger.error('render error', {
      message: error.message,
      componentStack: info.componentStack?.slice(0, 800),
    });
  }

  override componentDidUpdate(previous: ErrorBoundaryProps): void {
    const { resetKeys } = this.props;
    if (!this.state.error || !resetKeys) return;

    const previousKeys = previous.resetKeys ?? [];
    const changed =
      previousKeys.length !== resetKeys.length ||
      resetKeys.some((key, index) => !Object.is(key, previousKeys[index]));

    if (changed) this.reset();
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div
        role="alert"
        className="m-4 rounded-card border border-danger/25 bg-danger-surface px-5 py-4"
      >
        <div className="flex items-start gap-3">
          <AlertOctagon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-danger" />
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-text">This section could not be displayed</h2>
            <p className="text-sm text-text-muted">
              Your work is safe. Reload this section to try again — if it keeps happening, the error
              has been logged for us.
            </p>
            <Button variant="outline" size="sm" onClick={this.reset} className="self-start">
              <RefreshCw aria-hidden="true" className="size-4" />
              Reload this section
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
