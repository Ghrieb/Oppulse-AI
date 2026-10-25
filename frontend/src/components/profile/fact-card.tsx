import { ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { ProfileFact } from '@/lib/schemas';
import { FACT_STATE_META, factState } from './fact-state';
import { cn } from '@/lib/cn';

/**
 * A fact in the passport.
 *
 * The card is a summary: label, value, state. Everything else — the
 * provenance, the reason it matters, the actions — lives in the detail
 * panel, so a list of twenty facts stays readable.
 */
export function FactCard({
  fact,
  selected = false,
  onSelect,
}: {
  fact: ProfileFact;
  selected?: boolean;
  onSelect?: (fact: ProfileFact) => void;
}) {
  const state = factState(fact);
  const meta = FACT_STATE_META[state];

  const content = (
    <>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-meta font-medium text-text-muted">{fact.label}</span>
        <span className="truncate text-sm text-text">{fact.value}</span>
      </span>

      <Badge tone={meta.tone}>{meta.label}</Badge>

      {onSelect ? (
        <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-text-muted" />
      ) : null}
    </>
  );

  if (!onSelect) {
    return (
      <div className="flex min-h-11 items-center gap-3 rounded-card border border-border p-3">
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(fact)}
      aria-pressed={selected}
      className={cn(
        'flex min-h-11 w-full items-center gap-3 rounded-card border p-3 text-left transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
        selected
          ? 'border-primary/50 bg-primary/5'
          : 'border-border bg-surface hover:border-primary/30 hover:bg-surface-subtle',
      )}
    >
      {content}
    </button>
  );
}
