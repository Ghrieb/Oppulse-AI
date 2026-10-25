import { FileText } from 'lucide-react';
import type { ProfileFact } from '@/lib/schemas';
import { FACT_STATE_META, factState } from './fact-state';
import { cn } from '@/lib/cn';

/**
 * Fact provenance.
 *
 * Every extracted value shows where it came from, so the student can judge
 * it rather than trust it.
 */
export function FactProvenance({
  fact,
  className,
}: {
  fact: ProfileFact;
  className?: string | undefined;
}) {
  if (!fact.source) {
    return (
      <p className={cn('text-sm text-text-muted', className)}>
        This was entered by you, not extracted from a document.
      </p>
    );
  }

  return (
    <figure className={cn('flex flex-col gap-2', className)}>
      <figcaption className="flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-text-muted">
        <FileText aria-hidden="true" className="size-3.5 shrink-0" />
        <span className="font-medium text-text">From {fact.source.documentName}</span>
        {fact.source.pageReference ? <span>· {fact.source.pageReference}</span> : null}
        {fact.source.section ? <span>· {fact.source.section}</span> : null}
      </figcaption>

      <blockquote className="border-l-2 border-border pl-3 text-sm leading-relaxed text-text-muted italic">
        “{fact.source.excerpt}”
      </blockquote>
    </figure>
  );
}

/**
 * A conflicting value, shown beside the one Oppulse is using.
 */
export function FactConflict({ fact }: { fact: ProfileFact }) {
  if (!fact.conflict) return null;

  return (
    <div className="rounded-button border border-danger/30 bg-danger-surface p-3">
      <p className="text-meta font-medium text-danger">Two documents disagree</p>
      <p className="mt-1 text-sm text-text">
        <span className="font-medium">{fact.value}</span> — from{' '}
        {fact.source?.documentName ?? 'your CV'}
      </p>
      <p className="text-sm text-text">
        <span className="font-medium">{fact.conflict.value}</span> — from{' '}
        {fact.conflict.documentName}
        {fact.conflict.pageReference ? `, ${fact.conflict.pageReference}` : ''}
      </p>
      <blockquote className="mt-2 border-l-2 border-danger/40 pl-3 text-sm text-text-muted italic">
        “{fact.conflict.excerpt}”
      </blockquote>
      <p className="mt-2 text-meta text-text-muted">
        Correct the value above to settle this. Until then Oppulse uses the first one and says the
        requirement is unresolved.
      </p>
    </div>
  );
}

/** The plain-language explanation of what a fact is used for. */
export function FactUsedFor({ fact }: { fact: ProfileFact }) {
  if (!fact.usedFor) return null;

  return (
    <p className="text-sm text-text-muted">
      <span className="font-medium text-text">Used for: </span>
      {fact.usedFor}
    </p>
  );
}

/** The state of a fact, with its meaning. */
export function FactStateNote({ fact }: { fact: ProfileFact }) {
  const meta = FACT_STATE_META[factState(fact)];
  return <p className="text-sm text-text-muted">{meta.description}</p>;
}
