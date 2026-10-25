import { useMemo } from 'react';
import { FileText, GraduationCap, Link2, ScrollText, Target, X } from 'lucide-react';
import { useAgent } from '@/lib/agent-context';
import { useApplication, useDraft, useMissions, useOpportunity } from '@/lib/queries';
import { cn } from '@/lib/cn';

/**
 * The working context.
 *
 * It states exactly what the agent is using for this conversation — and,
 * just as importantly, what it is not. Nothing is ever added silently: a
 * chip appears because the user asked for it.
 */
export function ContextStrip({ className }: { className?: string }) {
  const { context, setContext, clearContext } = useAgent();

  const { data: opportunity } = useOpportunity(context.opportunityId ?? null);
  const { data: application } = useApplication(context.applicationId ?? null);
  const { data: draft } = useDraft(context.draftId ?? null);
  const { data: missions } = useMissions();

  const mission = useMemo(
    () => missions?.missions.find((item) => item.id === context.missionId),
    [missions, context.missionId],
  );

  const chips: { key: string; label: string; detail: string; Icon: typeof Target }[] = [];

  if (mission) {
    chips.push({
      key: 'missionId',
      label: mission.title,
      detail: mission.status === 'active' ? 'Active mission' : `Mission · ${mission.status}`,
      Icon: Target,
    });
  }
  if (opportunity) {
    chips.push({
      key: 'opportunityId',
      label: opportunity.opportunity.title,
      detail: `Opportunity · ${opportunity.opportunity.country.name}`,
      Icon: GraduationCap,
    });
  }
  if (application) {
    chips.push({
      key: 'applicationId',
      label: application.opportunityTitle,
      detail: `Application · ${application.completion.completed}/${application.completion.total} ready`,
      Icon: ScrollText,
    });
  }
  if (draft) {
    chips.push({
      key: 'draftId',
      label: draft.title,
      detail: `Draft · version ${draft.currentVersion}`,
      Icon: FileText,
    });
  }

  const hasContext = chips.length > 0;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {hasContext ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-meta font-medium text-text-muted">Working on</span>
          {chips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-subtle py-1 pr-1 pl-2.5 text-xs"
            >
              <chip.Icon aria-hidden="true" className="size-3.5 text-primary" />
              <span className="max-w-48 truncate font-medium text-text">{chip.label}</span>
              <span className="hidden text-text-muted sm:inline">{chip.detail}</span>
              <button
                type="button"
                onClick={() => setContext({ [chip.key]: undefined })}
                aria-label={`Remove ${chip.label} from the working context`}
                className="grid size-6 place-items-center rounded-full text-text-muted hover:bg-surface hover:text-text focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus-ring"
              >
                <X aria-hidden="true" className="size-3" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={clearContext}
            className="text-xs font-medium text-text-muted underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            Clear all
          </button>
        </div>
      ) : (
        <p className="flex items-center gap-1.5 text-meta text-text-muted">
          <Link2 aria-hidden="true" className="size-3.5" />
          No specific item selected — Oppulse will use your confirmed profile only.
        </p>
      )}
    </div>
  );
}
