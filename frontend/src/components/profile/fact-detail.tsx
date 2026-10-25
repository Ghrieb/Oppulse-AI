import { useState } from 'react';
import { AlertTriangle, Check, EyeOff, Pencil, RotateCcw, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { FACT_STATE_META, factState } from './fact-state';
import { FactConflict, FactProvenance, FactStateNote, FactUsedFor } from './fact-provenance';
import type { ProfileFact } from '@/lib/schemas';

/**
 * The detail of one fact.
 *
 * It answers four questions in order: what is the value, where did it come
 * from, what is it used for, and what is it holding up.
 */
export function FactDetail({
  fact,
  blockedRequirements = [],
  onConfirm,
  onCorrect,
  onExclude,
  onRestore,
  onReject,
  pending = false,
}: {
  fact: ProfileFact;
  /** The eligibility requirements waiting on this fact. */
  blockedRequirements?: {
    opportunityId: string;
    requirementId: string;
    opportunityTitle: string;
    requirementLabel: string;
    status: string;
  }[];
  onConfirm?: () => void;
  onCorrect?: (value: string) => void;
  onExclude?: () => void;
  onRestore?: () => void;
  onReject?: () => void;
  pending?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(fact.value);

  const state = factState(fact);
  const meta = FACT_STATE_META[state];
  const isConfirmed = fact.status === 'confirmed';
  const isResolved = state === 'confirmed' || state === 'corrected';

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-meta font-medium text-text-muted">{fact.label}</span>
          <Badge tone={meta.tone}>{meta.label}</Badge>
        </div>

        {editing ? (
          <div className="flex items-center gap-2">
            <label htmlFor={`correct-${fact.id}`} className="sr-only">
              Corrected value for {fact.label}
            </label>
            <Input
              id={`correct-${fact.id}`}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              autoFocus
            />
            <Button
              size="sm"
              onClick={() => {
                onCorrect?.(value.trim());
                setEditing(false);
              }}
              loading={pending}
              loadingLabel="Saving…"
              disabled={!value.trim()}
            >
              <Check aria-hidden="true" className="size-4" />
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              <X aria-hidden="true" className="size-4" />
              Cancel
            </Button>
          </div>
        ) : (
          <p className="text-xl leading-tight font-semibold text-text">{fact.value}</p>
        )}

        <FactStateNote fact={fact} />
      </div>

      <FactConflict fact={fact} />
      <FactProvenance fact={fact} />
      <FactUsedFor fact={fact} />

      {blockedRequirements.length > 0 ? (
        <div className="rounded-button border border-warning/30 bg-warning-surface p-3">
          <p className="flex items-center gap-1.5 text-meta font-medium text-warning">
            <AlertTriangle aria-hidden="true" className="size-3.5" />
            Holding up {blockedRequirements.length} requirement
            {blockedRequirements.length === 1 ? '' : 's'}
          </p>
          <ul className="mt-1.5 flex flex-col gap-1">
            {blockedRequirements.map((requirement) => (
              <li
                key={`${requirement.opportunityId}-${requirement.requirementId}`}
                className="text-sm text-text"
              >
                <span className="font-medium">{requirement.requirementLabel}</span>
                <span className="text-text-muted"> — {requirement.opportunityTitle}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : isResolved ? (
        <p className="rounded-button border border-success/30 bg-success-surface p-3 text-sm text-success">
          Every requirement that depends on this is settled.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        {!isConfirmed && onConfirm ? (
          <Button size="sm" onClick={onConfirm} loading={pending} loadingLabel="Confirming…">
            <Check aria-hidden="true" className="size-4" />
            Confirm
          </Button>
        ) : null}

        {onCorrect ? (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            <Pencil aria-hidden="true" className="size-4" />
            Correct
          </Button>
        ) : null}

        {fact.status !== 'rejected' && onReject ? (
          <Button
            size="sm"
            variant="ghost"
            loading={pending}
            loadingLabel="Rejecting…"
            onClick={onReject}
          >
            <X aria-hidden="true" className="size-4" />
            Not mine
          </Button>
        ) : null}

        {fact.excluded && onRestore ? (
          <Button
            size="sm"
            variant="outline"
            loading={pending}
            loadingLabel="Updating…"
            onClick={onRestore}
          >
            <RotateCcw aria-hidden="true" className="size-4" />
            Undo exclude
          </Button>
        ) : onExclude ? (
          <Button
            size="sm"
            variant="ghost"
            loading={pending}
            loadingLabel="Excluding…"
            onClick={onExclude}
          >
            <EyeOff aria-hidden="true" className="size-4" />
            Exclude from AI use
          </Button>
        ) : null}
      </div>

      {fact.updatedAt ? (
        <p className="text-meta text-text-muted">
          Last updated{' '}
          {new Date(fact.updatedAt).toLocaleString('en-GB', {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        </p>
      ) : null}
    </Card>
  );
}
