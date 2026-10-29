import { useState } from 'react';
import { Scale, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/tooltip';
import { ErrorState } from '@/components/feedback/states';
import { useCompareOpportunities, useOpportunities } from '@/lib/queries';
import { cn } from '@/lib/cn';
import type { CompareResponse } from '@/lib/schemas';

/**
 * The eligibility labels, spelled out — colour is never the only signal.
 */
const ELIGIBILITY_LABEL: Record<CompareResponse['rows'][number]['eligibility'], string> = {
  likely: 'Likely eligible',
  unresolved: 'Needs verification',
  ineligible: 'Not eligible',
};

const COVERAGE_LABEL: Record<CompareResponse['rows'][number]['fundingCoverage'], string> = {
  fully_funded: 'Fully funded',
  partial: 'Partly funded',
  tuition_only: 'Tuition only',
  unfunded: 'Not funded',
  unknown: 'Funding not confirmed',
};

/**
 * Side-by-side comparison.
 *
 * A read of what the agent already found: the same eligibility, funding
 * and deadline for two to four opportunities, with the differences named
 * and what the comparison cannot settle stated plainly. It never invents a
 * ranking (spec §6.4).
 */
export function CompareDialog({
  open,
  onOpenChange,
  currentId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The opportunity the dialog was opened from — always part of the set. */
  currentId: string;
}) {
  const { data, isPending, error, refetch } = useOpportunities();
  const compare = useCompareOpportunities();
  const [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState<CompareResponse | null>(null);

  const candidates = (data?.opportunities ?? []).filter(
    (opportunity) => opportunity.id !== currentId,
  );

  const toggle = (id: string) => {
    setResult(null);
    setSelected((existing) =>
      existing.includes(id)
        ? existing.filter((item) => item !== id)
        : existing.length >= 3
          ? existing
          : [...existing, id],
    );
  };

  const run = () => {
    compare.mutate([currentId, ...selected], {
      onSuccess: setResult,
      onError: () => setResult(null),
    });
  };

  const close = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSelected([]);
      setResult(null);
      compare.reset();
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale aria-hidden="true" className="size-4.5 text-primary" />
            Compare opportunities
          </DialogTitle>
          <DialogDescription>
            Side-by-side facts from the sources already retrieved. Oppulse names the differences —
            it does not rank one opportunity above another.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {isPending ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-11" />
              <Skeleton className="h-11" />
            </div>
          ) : error ? (
            <ErrorState error={error} onRetry={() => void refetch()} />
          ) : (
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium text-text">
                Pick up to three more opportunities
              </legend>
              <ul className="flex flex-col gap-1.5 pt-2">
                {candidates.map((opportunity) => {
                  const checked = selected.includes(opportunity.id);
                  const disabled = !checked && selected.length >= 3;

                  return (
                    <li key={opportunity.id}>
                      <label
                        className={cn(
                          'flex min-h-11 cursor-pointer items-start gap-3 rounded-button border px-3 py-2.5',
                          'focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus-ring',
                          disabled ? 'opacity-55' : 'hover:bg-surface-subtle',
                          checked ? 'border-primary bg-primary/[0.04]' : 'border-border bg-surface',
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={disabled}
                          onChange={() => toggle(opportunity.id)}
                          className="mt-1 size-4 shrink-0 accent-primary"
                        />
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className="text-sm font-medium text-text">{opportunity.title}</span>
                          <span className="text-meta text-text-muted">
                            {opportunity.institution} · {opportunity.country.name}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          )}

          <div className="flex items-center justify-between gap-3">
            <span className="text-meta text-text-muted">
              {selected.length === 0
                ? 'Select at least one other opportunity.'
                : `${selected.length + 1} opportunities selected.`}
            </span>
            <Button
              size="sm"
              disabled={selected.length === 0}
              loading={compare.isPending}
              loadingLabel="Comparing…"
              onClick={run}
            >
              <Sparkles aria-hidden="true" className="size-4" />
              Compare
            </Button>
          </div>

          {compare.isError ? (
            <p className="rounded-button border border-danger/30 bg-danger-surface px-3 py-2 text-sm text-danger">
              We could not compare those opportunities. Nothing was changed — try again.
            </p>
          ) : null}

          {result ? <CompareResult result={result} /> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CompareResult({ result }: { result: CompareResponse }) {
  const attributes: { label: string; value: (row: CompareResponse['rows'][number]) => string }[] = [
    { label: 'Profile match', value: (row) => `${row.fitScore}/100` },
    { label: 'Eligibility', value: (row) => ELIGIBILITY_LABEL[row.eligibility] },
    {
      label: 'Deadline',
      value: (row) =>
        row.deadline
          ? `${new Date(row.deadline).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}${row.deadlineVerified ? '' : ' · unverified'}`
          : 'Not stated',
    },
    { label: 'Funding', value: (row) => COVERAGE_LABEL[row.fundingCoverage] },
    {
      label: 'Unresolved requirements',
      value: (row) =>
        row.unresolvedRequirements.length > 0
          ? row.unresolvedRequirements.join('; ')
          : 'None recorded',
    },
  ];

  return (
    <div className="flex flex-col gap-4 border-t border-border pt-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-sm">
          <caption className="sr-only">
            Comparison of the selected opportunities across profile match, eligibility, deadline,
            funding and unresolved requirements.
          </caption>
          <thead>
            <tr className="border-b border-border text-left">
              <th scope="col" className="px-3 py-2.5 font-medium text-text-muted">
                Attribute
              </th>
              {result.rows.map((row) => (
                <th key={row.opportunityId} scope="col" className="px-3 py-2.5 align-bottom">
                  <span className="block text-sm font-semibold text-text">{row.title}</span>
                  <span className="block text-meta font-normal text-text-muted">
                    {row.institution}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {attributes.map((attribute) => (
              <tr key={attribute.label} className="border-b border-border last:border-0">
                <th
                  scope="row"
                  className="px-3 py-2.5 text-left font-medium whitespace-nowrap text-text-muted"
                >
                  {attribute.label}
                </th>
                {result.rows.map((row) => (
                  <td key={row.opportunityId} className="px-3 py-2.5 text-text">
                    {attribute.value(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {result.differences.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <h3 className="text-sm font-semibold text-text">What differs</h3>
          <ul className="flex flex-col gap-1.5">
            {result.differences.map((difference) => (
              <li key={difference} className="flex items-start gap-2 text-sm text-text">
                <span
                  aria-hidden="true"
                  className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary"
                />
                {difference}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {result.unverified.length > 0 ? (
        <div className="rounded-button border border-warning/30 bg-warning-surface px-3.5 py-3">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-warning">
            What this comparison cannot settle
          </h3>
          <ul className="mt-1.5 flex flex-col gap-1">
            {result.unverified.map((item) => (
              <li key={item} className="text-sm text-warning/90">
                {item}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="text-meta text-text-muted">
        Profile match describes how well your confirmed profile fits each call.{' '}
        <Badge tone="neutral">Not an admission probability</Badge>
      </p>
    </div>
  );
}
