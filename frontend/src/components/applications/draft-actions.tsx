import { useNavigate } from 'react-router-dom';
import { FilePlus2, Info } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useToast } from '@/lib/hooks/use-toast';
import { useCreateDraft } from '@/lib/queries';
import { DRAFT_TYPE_META, type DraftType } from '@/lib/schemas';

/**
 * The documents a student can start.
 *
 * The agent prepares all of them and sends none of them. The recommender
 * material is deliberately a separate, clearly-labelled thing: it is not a
 * letter and the agent does not write it as one.
 */
const STARTABLE: DraftType[] = [
  'motivation_letter',
  'research_statement',
  'supervisor_email',
  'recommender_request',
];

export function DraftActions({
  applicationId,
  className,
}: {
  applicationId: string;
  className?: string | undefined;
}) {
  const navigate = useNavigate();
  const createDraft = useCreateDraft();
  const { toast } = useToast();

  return (
    <Card className={className}>
      <div className="flex flex-col gap-1">
        <h2 className="flex items-center gap-2 text-card-title font-semibold text-text">
          <FilePlus2 aria-hidden="true" className="size-4 text-primary" />
          Start a document
        </h2>
        <p className="text-sm text-text-muted">
          Each one starts as a draft grounded in your confirmed facts. You edit it; nothing is sent.
        </p>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {STARTABLE.map((type) => {
          const meta = DRAFT_TYPE_META[type];

          return (
            <button
              key={type}
              type="button"
              disabled={createDraft.isPending}
              onClick={() => {
                createDraft.mutate(
                  { id: applicationId, type },
                  {
                    onSuccess: (draft) => {
                      void navigate(`/writing/${draft.id}`);
                      toast({
                        tone: 'success',
                        title: 'Draft created',
                        description: 'It is a starting point. Edit it before you send it.',
                      });
                    },
                    onError: () =>
                      toast({
                        tone: 'error',
                        title: 'We could not create that draft',
                        description: 'Nothing was saved. Try again.',
                      }),
                  },
                );
              }}
              className="flex min-h-11 flex-col items-start gap-1 rounded-button border border-border p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/[0.03] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:pointer-events-none disabled:opacity-55"
            >
              <span className="text-sm font-medium text-text">
                {createDraft.isPending ? 'Starting…' : meta.label}
              </span>
              <span className="text-meta text-text-muted">{meta.description}</span>
            </button>
          );
        })}
      </div>

      <p className="mt-4 flex items-start gap-2 border-t border-border pt-3 text-meta text-text-muted">
        <Info aria-hidden="true" className="mt-px size-3.5 shrink-0" />
        Need something for your referee instead? That is{' '}
        <span className="font-medium text-text">briefing material</span> for them to write from — it
        is not a letter, and Oppulse never writes one as them.
      </p>
    </Card>
  );
}
