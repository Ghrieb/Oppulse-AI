import type { LucideIcon } from 'lucide-react';
import { ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';

export interface IntentCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  bestFor: string;
  selected: boolean;
  onSelect: () => void;
}

/**
 * A starting path.
 *
 * The three paths are entry points into one shared flow, not separate
 * products, so the card says what it is best for rather than implying a
 * different application.
 */
export function IntentCard({
  icon: Icon,
  title,
  description,
  bestFor,
  selected,
  onSelect,
}: IntentCardProps) {
  return (
    <Card
      className={cn(
        'group flex h-full flex-col gap-3 p-5 text-left transition-colors',
        'hover:border-primary/40 hover:bg-primary/[0.03]',
        selected && 'border-primary/50 bg-primary/5',
      )}
    >
      <span
        aria-hidden="true"
        className="grid size-11 place-items-center rounded-button bg-primary/12 text-primary"
      >
        <Icon className="size-5" />
      </span>

      <div className="flex flex-col gap-1.5">
        <h3 className="text-card-title font-semibold text-text">{title}</h3>
        <p className="text-sm text-text-muted">{description}</p>
      </div>

      <p className="text-meta text-text-muted">Best for: {bestFor}</p>

      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={cn(
          'mt-auto inline-flex min-h-11 items-center justify-between gap-2 rounded-button px-3 text-sm font-medium',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
          selected ? 'bg-primary text-white' : 'bg-surface-subtle text-text hover:bg-border/60',
        )}
      >
        {selected ? 'Selected' : 'Start here'}
        <ArrowRight aria-hidden="true" className="size-4" />
      </button>
    </Card>
  );
}
