import { useEffect, useRef } from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Form error presentation.
 *
 * Field errors sit next to the field; a summary sits at the top of a long
 * form and takes focus after a failed submit (spec §5.2).
 */

export function InlineValidation({
  message,
  className,
  id,
}: {
  message: string;
  className?: string;
  id?: string;
}) {
  return (
    <p id={id} className={cn('flex items-start gap-1.5 text-meta text-danger', className)}>
      <AlertCircle aria-hidden="true" className="mt-px size-3.5 shrink-0" />
      {message}
    </p>
  );
}

export interface ErrorSummaryProps {
  /** Flat list of field problems, e.g. "Email — Enter a valid email address.". */
  errors: readonly string[];
  title?: string;
  className?: string;
}

/**
 * A focusable summary of form errors. Focus moves here after a failed
 * submit so keyboard and screen-reader users are not left hunting.
 */
export function ErrorSummary({
  errors,
  title = 'There is a problem',
  className,
}: ErrorSummaryProps) {
  const headingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (errors.length > 0) headingRef.current?.focus();
  }, [errors]);

  if (errors.length === 0) return null;

  return (
    <div
      ref={headingRef}
      tabIndex={-1}
      role="alert"
      aria-labelledby="error-summary-title"
      className={cn(
        'rounded-card border border-danger/30 bg-danger-surface px-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
        className,
      )}
    >
      <h2
        id="error-summary-title"
        className="flex items-center gap-2 text-sm font-semibold text-text"
      >
        <AlertCircle aria-hidden="true" className="size-4 text-danger" />
        {title}
      </h2>
      <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm text-text-muted">
        {errors.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    </div>
  );
}
