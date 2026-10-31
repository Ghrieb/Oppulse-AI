import { AlertTriangle, CheckCircle2, CircleHelp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';
import type { Deadline, Funding, Match, RequirementStatus } from '@/lib/schemas';

/* The five concepts the product deliberately keeps apart: fit, eligibility,
 * funding, competitiveness and confidence. Conflating them is the single
 * most common way an opportunity tool misleads a student.
 */

/* Competitiveness labels — only shown when there is evidence. */
const COMPETITIVENESS_META: Record<
  Match['competitiveness'],
  { label: string; tone: 'success' | 'warning' | 'neutral'; hasEvidence: boolean }
> = {
  high: { label: 'Highly competitive', tone: 'warning', hasEvidence: true },
  moderate: { label: 'Moderately competitive', tone: 'success', hasEvidence: true },
  low: { label: 'Not competitive', tone: 'neutral', hasEvidence: true },
  unknown: { label: 'Competition unknown', tone: 'neutral', hasEvidence: false },
};

/* Show competitiveness badge only when the match has evidence. */
export function CompetitivenessBadge({ value }: { value: Match['competitiveness'] }) {
  const meta = COMPETITIVENESS_META[value];
  if (!meta.hasEvidence) {
    return <Badge tone="neutral" icon={<CircleHelp />}>Competition not assessed</Badge>;
  }
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

/* Confidence labels — "medium" is a placeholder when no evidence exists. */
const CONFIDENCE_META: Record<
  Match['confidence'],
  { label: string; tone: 'success' | 'warning' | 'neutral'; hasEvidence: boolean }
> = {
  high: { label: 'High confidence', tone: 'success', hasEvidence: true },
  medium: { label: 'Medium confidence', tone: 'warning', hasEvidence: false },
  low: { label: 'Low confidence', tone: 'neutral', hasEvidence: true },
};

/* Show confidence badge only when there is evidence beyond the default "medium". */
export function ConfidenceBadge({ value }: { value: Match['confidence'] }) {
  const meta = CONFIDENCE_META[value];
  if (!meta.hasEvidence) {
    return <Badge tone="neutral" icon={<CircleHelp />}>Confidence unknown</Badge>;
  }
  const label = { high: 'High confidence', medium: 'Medium confidence', low: 'Low confidence' }[value];
  const tone = { high: 'success', medium: 'warning', low: 'neutral' }[value] as 'success' | 'warning' | 'neutral';
  return <Badge tone={tone}>{label}</Badge>;
}

/* Eligibility status with explicit "showBadge" control so the UI can
 * hide the badge when the status is the default "unresolved" placeholder. */
const ELIGIBILITY_META: Record<
  RequirementStatus,
  { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral'; showBadge: boolean }
> = {
  likely: { label: 'Likely eligible', tone: 'success', showBadge: true },
  unresolved: { label: 'Needs verification', tone: 'warning', showBadge: false },
  ineligible: { label: 'Not eligible', tone: 'danger', showBadge: true },
  not_applicable: { label: 'Not applicable', tone: 'neutral', showBadge: false },
};

/* Show eligibility badge only when there is a meaningful status. */
export function EligibilityBadge({ status }: { status: RequirementStatus }) {
  const meta = ELIGIBILITY_META[status];
  if (!meta.showBadge) {
    return <span className="text-sm text-text-muted">{meta.label}</span>;
  }
  return (
    <Badge tone={meta.tone}>
      {meta.label}
    </Badge>
  );
}

/* Fit score display — shows the match percentage. */
export function FitScore({ match }: { match: Match | null | undefined }) {
  if (!match) return <span className="text-text-muted">Not assessed</span>;
  const pct = Math.round((match.fitScore ?? 0) * 100);
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-sm font-medium text-text">{pct}% match</span>
    </div>
  );
}

/* Summary of eligibility requirements from the match. */
export function EligibilitySummary({ eligibility }: { eligibility: string | undefined }) {
  if (!eligibility) return <span className="text-text-muted">Not assessed</span>;
  return (
    <div className="flex items-start gap-2">
      <span className="size-3 rounded-full bg-success" aria-hidden="true" />
      <span className="font-medium text-text">{eligibility}</span>
    </div>
  );
}

/* Funding coverage display. */
export function FundingCoverage({ funding }: { funding: Funding }) {
  const coverage = FUNDING_COVERAGE_LABEL[funding.coverage];
  const tone = FUNDING_TONE[funding.coverage];
  return (
    <div className="flex items-baseline gap-1.5">
      <Badge tone={tone}>{coverage}</Badge>
    </div>
  );
}

/* Funding coverage labels — shared across every surface. */
export const FUNDING_COVERAGE_LABEL: Record<Funding['coverage'], string> = {
  fully_funded: 'Fully funded',
  partial: 'Partly funded',
  tuition_only: 'Tuition only',
  unfunded: 'Not funded',
  unknown: 'Funding not confirmed',
};

/* Tone mapping for funding coverage labels. */
export const FUNDING_TONE: Record<Funding['coverage'], 'success' | 'warning' | 'danger' | 'neutral'> = {
  fully_funded: 'success',
  partial: 'warning',
  tuition_only: 'warning',
  unfunded: 'danger',
  unknown: 'neutral',
};

/* Deadline badge — only show verified badge when evidence exists. */
export function DeadlineBadge({ deadline }: { deadline: Deadline }) {
  if (deadline.status === 'conflict') {
    return (
      <Badge tone="warning" icon={<AlertTriangle />}>
        Deadline conflict
      </Badge>
    );
  }

  if (deadline.status === 'not_found' || !deadline.value) {
    return <Badge tone="neutral">Deadline unknown</Badge>;
  }

  if (deadline.status === 'unresolved') {
    return (
      <Badge tone="warning" icon={<CircleHelp />}>
        Deadline unverified
      </Badge>
    );
  }

  /** deadline.status === 'verified' */
  return (
    <Badge tone="success" icon={<CheckCircle2 />}>
      Deadline verified
    </Badge>
  );
}

/* DeadlineLine — shows the date when verified, or a plain "not yet" line. */
export function DeadlineLine({ deadline }: { deadline: Deadline }) {
  if (!deadline.value) {
    return <p className="text-sm text-text-muted">No deadline has been verified yet.</p>;
  }

  const remaining =
    deadline.remainingDays === null
      ? null
      : deadline.remainingDays <= 0
        ? 'closed'
        : `${deadline.remainingDays} days left`;

  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm font-medium text-text">
        {new Date(deadline.value).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })}
        {deadline.timezone ? <span className="text-text-muted"> · {deadline.timezone}</span> : null}
      </p>
      {remaining ? (
        <p className={cn('text-meta', remaining === 'closed' ? 'text-danger' : 'text-text-muted')}>
          {remaining}
        </p>
      ) : null}
      {deadline.note ? <p className="text-meta text-text-muted">{deadline.note}</p> : null}
    </div>
  );
}