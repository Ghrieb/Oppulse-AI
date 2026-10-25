import { AlertTriangle, CheckCircle2, CircleHelp, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScoreRing } from '@/components/ui/display';
import { cn } from '@/lib/cn';
import type { Deadline, Funding, Match, RequirementStatus } from '@/lib/schemas';

/**
 * The five concepts the product deliberately keeps apart: fit, eligibility,
 * funding, competitiveness and confidence. Conflating them is the single
 * most common way an opportunity tool misleads a student.
 */

export function FitScore({
  match,
  size = 'md',
}: {
  match: Pick<Match, 'fitScore' | 'fitLabel'>;
  size?: 'sm' | 'md' | 'lg';
}) {
  const ringSize = { sm: 48, md: 64, lg: 88 }[size];

  return (
    <div className="flex flex-col items-center gap-1">
      <ScoreRing
        value={match.fitScore}
        label={`Profile match: ${match.fitScore} out of 100. This is not an admission probability.`}
        size={ringSize}
        tone={match.fitScore >= 85 ? 'success' : match.fitScore >= 70 ? 'primary' : 'muted'}
      />
      <span className="text-meta text-text-muted">
        <span className="font-medium text-text">Profile match</span> · {match.fitScore}/100
      </span>
      <span className="sr-only">This is not an admission probability.</span>
    </div>
  );
}

const ELIGIBILITY_META: Record<
  RequirementStatus,
  { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral'; Icon: typeof CheckCircle2 }
> = {
  likely: { label: 'Likely eligible', tone: 'success', Icon: CheckCircle2 },
  unresolved: { label: 'Needs verification', tone: 'warning', Icon: CircleHelp },
  ineligible: { label: 'Not eligible', tone: 'danger', Icon: XCircle },
  not_applicable: { label: 'Not applicable', tone: 'neutral', Icon: CheckCircle2 },
};

export function EligibilityBadge({ status }: { status: RequirementStatus }) {
  const meta = ELIGIBILITY_META[status];
  const Icon = meta.Icon;

  return (
    <Badge tone={meta.tone} icon={<Icon />}>
      {meta.label}
    </Badge>
  );
}

export function EligibilitySummary({ eligibility }: { eligibility: Match['eligibility'] }) {
  switch (eligibility) {
    case 'likely':
      return (
        <Badge tone="success" icon={<CheckCircle2 />}>
          Eligibility: likely
        </Badge>
      );
    case 'ineligible':
      return (
        <Badge tone="danger" icon={<XCircle />}>
          Eligibility: not met
        </Badge>
      );
    default:
      return (
        <Badge tone="warning" icon={<CircleHelp />}>
          Eligibility: unresolved
        </Badge>
      );
  }
}

const COMPETITIVENESS_META: Record<
  Match['competitiveness'],
  { label: string; tone: 'success' | 'warning' | 'neutral' }
> = {
  high: { label: 'Highly competitive', tone: 'warning' },
  moderate: { label: 'Moderately competitive', tone: 'success' },
  low: { label: 'Not competitive', tone: 'neutral' },
  unknown: { label: 'Competition unknown', tone: 'neutral' },
};

export function CompetitivenessBadge({ value }: { value: Match['competitiveness'] }) {
  const meta = COMPETITIVENESS_META[value];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function ConfidenceBadge({ value }: { value: Match['confidence'] }) {
  const label = { high: 'High confidence', medium: 'Medium confidence', low: 'Low confidence' }[
    value
  ];
  const tone = { high: 'success', medium: 'warning', low: 'neutral' }[value] as
    'success' | 'warning' | 'neutral';

  return <Badge tone={tone}>{label}</Badge>;
}

export function FundingCoverage({
  funding,
  compact = false,
}: {
  funding: Funding;
  compact?: boolean;
}) {
  const coverageLabel: Record<Funding['coverage'], string> = {
    fully_funded: 'Fully funded',
    partial: 'Partially funded',
    tuition_only: 'Tuition only',
    unfunded: 'Not funded',
    unknown: 'Funding unknown',
  };

  const tone: Record<Funding['coverage'], 'success' | 'warning' | 'danger' | 'neutral'> = {
    fully_funded: 'success',
    partial: 'warning',
    tuition_only: 'warning',
    unfunded: 'danger',
    unknown: 'neutral',
  };

  if (compact) {
    return <Badge tone={tone[funding.coverage]}>{coverageLabel[funding.coverage]}</Badge>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Badge tone={tone[funding.coverage]}>{coverageLabel[funding.coverage]}</Badge>
        {funding.estimatedGap ? (
          <span className="text-sm font-medium text-warning">
            Gap ≈ {funding.estimatedGap.amount} {funding.estimatedGap.currency}
          </span>
        ) : null}
      </div>

      <ul className="flex flex-col gap-1.5">
        {funding.components.map((component) => (
          <li key={component.label} className="flex items-start justify-between gap-3 text-sm">
            <span className="text-text">{component.label}</span>
            <span className="flex shrink-0 items-center gap-2">
              {component.amount ? (
                <span className="font-medium text-text tabular-nums">{component.amount}</span>
              ) : null}
              <Badge
                tone={
                  component.status === 'confirmed'
                    ? 'success'
                    : component.status === 'partial'
                      ? 'warning'
                      : component.status === 'not_covered'
                        ? 'danger'
                        : 'neutral'
                }
              >
                {component.status === 'confirmed'
                  ? 'Confirmed'
                  : component.status === 'partial'
                    ? 'Partial'
                    : component.status === 'not_covered'
                      ? 'Not covered'
                      : 'Unknown'}
              </Badge>
            </span>
          </li>
        ))}
      </ul>

      {funding.estimatedGap ? (
        <p className="rounded-button bg-warning-surface px-3 py-2 text-meta text-warning">
          Estimated uncovered cost {funding.estimatedGap.amount} {funding.estimatedGap.currency}.{' '}
          {funding.estimatedGap.basis}
        </p>
      ) : null}

      {funding.note ? <p className="text-meta text-text-muted">{funding.note}</p> : null}
    </div>
  );
}

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

  return (
    <Badge tone="success" icon={<CheckCircle2 />}>
      Deadline verified
    </Badge>
  );
}

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
