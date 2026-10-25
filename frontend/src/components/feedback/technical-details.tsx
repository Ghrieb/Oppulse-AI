import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Check, ClipboardCopy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IS_MOCK_MODE, PRODUCT_MODE } from '@/lib/api/config';
import type { ApiError } from '@/lib/api/errors';
import { environmentLabel, formatTechnicalDetails } from '@/lib/technical-details';

/**
 * Copies the whitelisted details for one failure.
 *
 * Only request id, run id, error code, route, timestamp and environment are
 * built into the text (spec §A, line 845). The confirmation is announced
 * politely so a screen reader learns the copy succeeded without the button
 * stealing focus.
 */
export function TechnicalDetailsButton({
  error,
  runId,
  className,
}: {
  error: ApiError;
  /** Provided only where the caller genuinely knows it. */
  runId?: string | undefined;
  className?: string | undefined;
}) {
  const location = useLocation();
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  const copy = () => {
    const text = formatTechnicalDetails({
      requestId: error.requestId,
      runId,
      errorCode: error.code,
      route: `${location.pathname}${location.search}`,
      timestamp: new Date().toISOString(),
      environment: environmentLabel(IS_MOCK_MODE, PRODUCT_MODE),
    });

    // The DOM types promise a clipboard; in practice (file URLs, older
    // engines, tests) it can be missing, and the failure must be honest.
    const clipboard = navigator.clipboard as Clipboard | undefined;
    const write = clipboard?.writeText(text);
    if (!write) {
      setCopied(false);
      setFailed(true);
      return;
    }

    write
      .then(() => {
        setCopied(true);
        setFailed(false);
      })
      .catch(() => {
        setCopied(false);
        setFailed(true);
      });
  };

  return (
    <span className={className}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={copy}
        className="h-auto px-0 text-meta font-normal text-text-muted underline-offset-2 hover:underline"
      >
        {copied ? (
          <Check aria-hidden="true" className="size-3.5 text-success" />
        ) : (
          <ClipboardCopy aria-hidden="true" className="size-3.5" />
        )}
        {copied ? 'Copied' : 'Copy technical details'}
      </Button>
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? 'Technical details copied to the clipboard.' : ''}
        {failed ? 'Could not copy. The reference is shown above.' : ''}
      </span>
      {failed ? (
        <span className="block text-meta text-text-muted">
          Could not copy automatically — the reference is shown above.
        </span>
      ) : null}
    </span>
  );
}
