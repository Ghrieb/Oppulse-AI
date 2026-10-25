import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Circle,
  CircleDashed,
  ExternalLink,
  FileText,
  Info,
  Loader2,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAgent } from '@/lib/agent-context';
import type { AssistantBlock, MediaContext } from '@/lib/schemas';
import { cn } from '@/lib/cn';

/**
 * The assistant's answer cards.
 *
 * The agent answers with things the student can act on, not only with
 * paragraphs: evidence with its sources, a checklist, a document to start,
 * a run in progress, or a button bound to the current context.
 */
export function AssistantBlocks({ blocks }: { blocks: AssistantBlock[] }) {
  return (
    <div className="flex flex-col gap-3">
      {blocks.map((block, index) => (
        <AssistantBlockView key={`${block.kind}_${index}`} block={block} />
      ))}
    </div>
  );
}

function AssistantBlockView({ block }: { block: AssistantBlock }) {
  switch (block.kind) {
    case 'text':
      return <p className="text-sm leading-relaxed whitespace-pre-line text-text">{block.text}</p>;

    case 'evidence':
      return <EvidenceCard block={block} />;

    case 'checklist':
      return <ChecklistCard block={block} />;

    case 'draft_action':
      return <DraftActionCard block={block} />;

    case 'run':
      return <RunCard block={block} />;

    case 'institution':
      return <InstitutionCard block={block} />;

    case 'media_context':
      return <MediaContextCard block={block} />;

    case 'opportunity_reference':
      return <OpportunityReferenceCard block={block} />;

    case 'unknown_or_conflict':
      return <UnknownOrConflictCard block={block} />;

    case 'action':
      return <ActionCard block={block} />;

    default:
      return (
        <Card className="border-warning/30 bg-warning-surface p-4 text-sm text-warning">
          This answer used a format Oppulse does not display yet. The content was not lost.
        </Card>
      );
  }
}

function EffectBadge({ effect }: { effect: 'prepares' | 'would_send' }) {
  return effect === 'would_send' ? (
    <Badge tone="warning" icon={<AlertTriangle />}>
      Would send — needs your confirmation
    </Badge>
  ) : (
    <Badge tone="info" icon={<ShieldCheck />}>
      Prepares only
    </Badge>
  );
}

function EvidenceCard({ block }: { block: Extract<AssistantBlock, { kind: 'evidence' }> }) {
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-text">{block.title}</h3>
      </div>
      <p className="text-sm text-text-muted">{block.summary}</p>

      <ul className="flex flex-col gap-2">
        {block.sources.map((source) => (
          <li key={source.url} className="rounded-button border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-info underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
              >
                {source.title}
                <ExternalLink aria-hidden="true" className="size-3" />
              </a>
              <Badge
                tone={
                  source.quality === 'official'
                    ? 'success'
                    : source.quality === 'primary'
                      ? 'info'
                      : 'neutral'
                }
              >
                {source.quality === 'official'
                  ? 'Official source'
                  : source.quality === 'primary'
                    ? 'Primary source'
                    : source.quality === 'secondary'
                      ? 'Secondary source'
                      : source.quality === 'aggregator'
                        ? 'Directory listing'
                        : 'Quality unknown'}
              </Badge>
            </div>
            <blockquote className="mt-2 border-l-2 border-border pl-3 text-sm text-text-muted italic">
              “{source.quote}”
            </blockquote>
          </li>
        ))}
      </ul>
    </Card>
  );
}

const CHECK_STATUS_META = {
  done: { label: 'Done', tone: 'success' as const, Icon: CheckCircle2 },
  ready: { label: 'Ready', tone: 'info' as const, Icon: Circle },
  needs_attention: { label: 'Needs attention', tone: 'warning' as const, Icon: AlertTriangle },
  missing: { label: 'Missing', tone: 'neutral' as const, Icon: CircleDashed },
};

function ChecklistCard({ block }: { block: Extract<AssistantBlock, { kind: 'checklist' }> }) {
  return (
    <Card className="flex flex-col gap-3 p-4">
      <h3 className="text-sm font-semibold text-text">{block.title}</h3>
      <ul className="flex flex-col gap-2">
        {block.items.map((item) => {
          const meta = CHECK_STATUS_META[item.status];

          return (
            <li key={item.label} className="flex items-start gap-2.5">
              <meta.Icon
                aria-hidden="true"
                className={cn(
                  'mt-0.5 size-4 shrink-0',
                  item.status === 'done'
                    ? 'text-success'
                    : item.status === 'needs_attention'
                      ? 'text-warning'
                      : 'text-text-muted',
                )}
              />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm text-text">
                  {item.label}
                  <span className="ml-2 text-meta text-text-muted">({meta.label})</span>
                </span>
                {item.detail ? (
                  <span className="text-meta text-text-muted">{item.detail}</span>
                ) : null}
              </span>
              {item.route ? (
                <Link
                  to={item.route}
                  className="shrink-0 text-meta font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                >
                  Resolve
                </Link>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function DraftActionCard({ block }: { block: Extract<AssistantBlock, { kind: 'draft_action' }> }) {
  const { runAction, pending } = useAgent();
  const [confirming, setConfirming] = useState(false);
  const [created, setCreated] = useState(false);

  if (created) {
    return (
      <Card className="flex flex-col gap-3 border-success/30 bg-success-surface p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-success">
          <CheckCircle2 aria-hidden="true" className="size-4" />
          Draft created. Nothing has been sent.
        </p>
        {block.applicationId ? (
          <Button asChild size="sm" className="self-start">
            <Link to="/applications">Open the application workspace</Link>
          </Button>
        ) : null}
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-text">
          <FileText aria-hidden="true" className="size-4 text-primary" />
          {block.title}
        </h3>
        <EffectBadge effect={block.effect} />
      </div>

      <p className="text-sm text-text-muted">{block.description}</p>

      {confirming ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            loading={pending}
            loadingLabel="Creating the draft…"
            onClick={() => {
              if (pending) return;
              void runAction({
                action: 'create_draft',
                context: block.applicationId ? { applicationId: block.applicationId } : undefined,
                payload: { draftType: block.draftType },
              }).then((response) => {
                if (response) setCreated(true);
                setConfirming(false);
              });
            }}
          >
            Create the draft
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="self-start"
          onClick={() => setConfirming(true)}
        >
          Start this document
        </Button>
      )}
    </Card>
  );
}

function RunCard({ block }: { block: Extract<AssistantBlock, { kind: 'run' }> }) {
  return (
    <Card className="flex flex-col gap-3 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-text">
        {block.status === 'completed' ? (
          <CheckCircle2 aria-hidden="true" className="size-4 text-success" />
        ) : (
          <Loader2 aria-hidden="true" className="size-4 animate-spin text-primary" />
        )}
        {block.message}
      </p>
      <Button asChild size="sm" variant="outline" className="self-start">
        <Link to="/goals">
          Watch the run
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </Button>
    </Card>
  );
}

/**
 * The answer to a question about an institution.
 *
 * It is concise first and expandable second, and it separates what the
 * official source states from what Oppulse could not verify.
 */
function InstitutionCard({ block }: { block: Extract<AssistantBlock, { kind: 'institution' }> }) {
  const [showDetail, setShowDetail] = useState(false);

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="text-sm font-semibold text-text">{block.location}</h3>
          <p className="text-meta text-text-muted">
            {block.country}
            {block.institutionType ? ` · ${block.institutionType}` : ''}
          </p>
        </div>
        <Badge tone="info">Institution</Badge>
      </div>

      <p className="text-sm leading-relaxed text-text">{block.description}</p>

      {block.programmeContext ? (
        <p className="text-sm leading-relaxed text-text-muted">{block.programmeContext}</p>
      ) : null}

      {block.unverified.length > 0 ? (
        <div className="rounded-button border border-warning/30 bg-warning-surface p-3">
          <p className="flex items-center gap-1.5 text-meta font-medium text-warning">
            <AlertTriangle aria-hidden="true" className="size-3.5" />
            What I could not verify
          </p>
          <ul className="mt-1.5 list-disc pl-4 text-meta text-warning/90">
            {block.unverified.map((entry) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {block.evidence.length > 0 ? (
        <div>
          <button
            type="button"
            onClick={() => setShowDetail((open) => !open)}
            aria-expanded={showDetail}
            className="text-meta font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            {showDetail
              ? 'Hide the sources'
              : `Show the ${block.evidence.length} source${block.evidence.length === 1 ? '' : 's'}`}
          </button>

          {showDetail ? (
            <ul className="mt-2 flex flex-col gap-2">
              {block.evidence.map((entry) => (
                <li key={entry.url} className="rounded-button border border-border p-3">
                  <a
                    href={entry.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-info underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                  >
                    {entry.title}
                    <ExternalLink aria-hidden="true" className="size-3" />
                  </a>
                  <p className="mt-1 text-meta text-text-muted">
                    {entry.sourceType === 'official' ? 'Official source' : 'Secondary source'}
                  </p>
                  <blockquote className="mt-1.5 border-l-2 border-border pl-3 text-sm text-text-muted italic">
                    “{entry.quote}”
                  </blockquote>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {block.media.length > 0 ? <MediaList media={block.media} /> : null}

      {block.action ? <p className="text-meta text-text-muted">Next: {block.action}</p> : null}
    </Card>
  );
}

/**
 * Media, labelled as secondary.
 *
 * A video or an image never proves eligibility, funding or a deadline, and
 * the label says so where the media is shown.
 */
function MediaList({ media }: { media: MediaContext[] }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-center gap-1.5 text-meta font-medium text-text-muted">
        <Info aria-hidden="true" className="size-3.5" />
        Media context — secondary source
      </p>
      <ul className="flex flex-col gap-2">
        {media.map((item) => {
          const isGone = item.status === 'unavailable' || item.status === 'removed';

          return (
            <li key={item.url} className="rounded-button border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                {isGone ? (
                  <span className="text-sm font-medium text-text">{item.title}</span>
                ) : (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-info underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                  >
                    {item.title}
                    <ExternalLink aria-hidden="true" className="size-3" />
                  </a>
                )}
                <Badge
                  tone={
                    item.status === 'available'
                      ? 'neutral'
                      : item.status === 'not_reviewed'
                        ? 'neutral'
                        : 'warning'
                  }
                >
                  {item.status === 'available'
                    ? item.kind === 'video'
                      ? 'Video'
                      : 'Image'
                    : item.status === 'unavailable'
                      ? 'Unavailable'
                      : item.status === 'removed'
                        ? 'Removed'
                        : 'Not reviewed'}
                </Badge>
              </div>
              {item.status === 'unavailable' ? (
                <p className="mt-1 text-meta text-text-muted">
                  This asset could not be opened, so what it shows is not claimed here.
                </p>
              ) : null}
              {item.status === 'removed' ? (
                <p className="mt-1 text-meta text-text-muted">
                  The page no longer carries this asset.
                </p>
              ) : null}
              <p className="mt-1 text-meta text-text-muted">
                {item.publisher}
                {item.publishedAt ? ` · ${item.publishedAt.slice(0, 10)}` : ''} ·{' '}
                {item.sourceType === 'official'
                  ? 'Official'
                  : item.sourceType === 'verified_provider'
                    ? 'Verified provider'
                    : 'Secondary source'}
              </p>
              {item.summary ? <p className="mt-1 text-sm text-text-muted">{item.summary}</p> : null}
              {item.attribution ? (
                <p className="mt-1 text-meta text-text-muted">{item.attribution}</p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function MediaContextCard({
  block,
}: {
  block: Extract<AssistantBlock, { kind: 'media_context' }>;
}) {
  return (
    <Card className="flex flex-col gap-3 p-4">
      <p className="text-sm font-medium text-text">{block.subject}</p>
      <MediaList media={block.media} />
    </Card>
  );
}

/**
 * A reference to an opportunity.
 *
 * On desktop it opens the right-side panel without leaving the chat; on
 * mobile, where there is no panel, it opens the full opportunity page.
 * Either way the thread is preserved — it lives in the agent provider, not
 * in this card.
 */
function OpportunityReferenceCard({
  block,
}: {
  block: Extract<AssistantBlock, { kind: 'opportunity_reference' }>;
}) {
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="text-sm font-semibold text-text">{block.title}</h3>
          <p className="text-meta text-text-muted">
            {block.institution} · {block.country}
          </p>
        </div>
        <Badge tone="info">Opportunity</Badge>
      </div>

      <p className="text-sm text-text-muted">{block.reason}</p>

      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline" className="hidden sm:inline-flex">
          <Link to={`/home?opportunity=${block.opportunityId}`}>
            Open in the panel
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline" className="sm:hidden">
          <Link to={`/opportunities/${block.opportunityId}`}>
            Open the opportunity
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </Button>
      </div>
    </Card>
  );
}

/**
 * What could not be verified.
 *
 * The honest edge of an answer: what was checked, what remains unknown, and
 * the most useful next step.
 */
function UnknownOrConflictCard({
  block,
}: {
  block: Extract<AssistantBlock, { kind: 'unknown_or_conflict' }>;
}) {
  return (
    <Card
      className={cn(
        'flex flex-col gap-3 p-4',
        block.conflict ? 'border-warning/30 bg-warning-surface' : 'border-border bg-surface-subtle',
      )}
    >
      <p className="flex items-center gap-2 text-sm font-semibold text-text">
        {block.conflict ? (
          <AlertTriangle aria-hidden="true" className="size-4 text-warning" />
        ) : (
          <Info aria-hidden="true" className="size-4 text-text-muted" />
        )}
        {block.conflict ? 'Two sources disagree' : 'I could not verify this'}
      </p>

      <p className="text-sm leading-relaxed text-text">{block.question}</p>

      {block.checked.length > 0 ? (
        <div>
          <p className="text-meta font-medium text-text-muted">What I checked</p>
          <ul className="mt-1 list-disc pl-4 text-meta text-text-muted">
            {block.checked.map((entry) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {block.nextAction ? (
        <p className="text-sm text-text-muted">Next: {block.nextAction}</p>
      ) : null}
    </Card>
  );
}

function ActionCard({ block }: { block: Extract<AssistantBlock, { kind: 'action' }> }) {
  const { runAction, pending } = useAgent();
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <Card className="flex items-center gap-2 border-success/30 bg-success-surface p-4 text-sm font-medium text-success">
        <CheckCircle2 aria-hidden="true" className="size-4" />
        Done. Nothing was sent.
      </Card>
    );
  }

  const payload = block.payload as { draftType?: string; route?: string } | undefined;

  if (block.action === 'open_route' && payload?.route) {
    return (
      <Card className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="text-sm font-semibold text-text">{block.label}</p>
          <EffectBadge effect={block.effect} />
        </div>
        {block.description ? <p className="text-sm text-text-muted">{block.description}</p> : null}
        <Button asChild size="sm" variant="outline" className="self-start">
          <Link to={payload.route}>
            {block.label}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </Button>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm font-semibold text-text">{block.label}</p>
        <EffectBadge effect={block.effect} />
      </div>

      {block.description ? <p className="text-sm text-text-muted">{block.description}</p> : null}

      {confirming ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            loading={pending}
            loadingLabel="Running the action…"
            onClick={() => {
              if (pending) return;
              void runAction({
                action: block.action,
                payload: block.payload,
              }).then((response) => {
                if (response) setDone(true);
                setConfirming(false);
              });
            }}
          >
            Yes, {block.label.toLowerCase()}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
            <XCircle aria-hidden="true" className="size-4" />
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="self-start"
          onClick={() => setConfirming(true)}
        >
          {block.label}
        </Button>
      )}
    </Card>
  );
}

/** The standing disclosure, shown under the composer. */
export function ApprovalBoundaryNote({ className }: { className?: string }) {
  return (
    <p className={cn('flex items-start gap-1.5 text-meta text-text-muted', className)}>
      <Info aria-hidden="true" className="mt-px size-3.5 shrink-0" />
      Oppulse prepares. It never sends anything on your behalf — every external step is yours to
      confirm.
    </p>
  );
}
