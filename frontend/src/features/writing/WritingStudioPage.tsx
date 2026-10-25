import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  History,
  RefreshCw,
  Save,
  Sparkles,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/tooltip';
import { DiffViewer } from '@/components/ui/diff-viewer';
import { ErrorState, NotFoundState } from '@/components/feedback/states';
import { ApiError } from '@/lib/api/errors';
import { useToast } from '@/lib/hooks/use-toast';
import {
  useAcceptProposal,
  useCreateProposal,
  useDraft,
  useRejectProposal,
  useSaveDraft,
} from '@/lib/queries';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Writing studio.
 *
 * The AI never overwrites the document. It returns a proposal, the student
 * reviews a diff, and acceptance creates a new version (ADR-006).
 */
export default function WritingStudioPage() {
  const { draftId } = useParams<{ draftId: string }>();
  const { data: draft, isPending, error, refetch } = useDraft(draftId ?? null);
  const saveDraft = useSaveDraft();
  const createProposal = useCreateProposal();
  const acceptProposal = useAcceptProposal();
  const rejectProposal = useRejectProposal();
  const { toast } = useToast();

  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [instruction, setInstruction] = useState('');
  const [showDiff, setShowDiff] = useState(false);
  const [versionPanelOpen, setVersionPanelOpen] = useState(false);
  /** The editor is the source of truth for the text; the ref mirrors it. */
  const contentRef = useRef('');
  const loadedDraftId = useRef<string | null>(null);
  /** Bumped on every edit so the autosave effect re-runs. */
  const [revision, setRevision] = useState(0);
  /** Last known local copy, kept so a failed save never loses the text. */
  const [localBackup, setLocalBackup] = useState('');
  /** The text the student has selected, if any. */
  const [selection, setSelection] = useState<{ text: string; from: number; to: number } | null>(
    null,
  );

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Start writing your application…' }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class:
          'prose prose-sm max-w-none min-h-[24rem] px-5 py-4 focus:outline-none ' +
          '[&_p]:my-2 [&_h1]:text-xl [&_h2]:text-lg [&_ul]:list-disc [&_ul]:pl-5',
      },
    },
    onUpdate: ({ editor: instance }) => {
      contentRef.current = JSON.stringify(instance.getJSON());
      setRevision((value) => value + 1);
      setSaveState('idle');
    },
    onSelectionUpdate: ({ editor: instance }) => {
      const { from, to } = instance.state.selection;
      if (from === to) {
        setSelection(null);
        return;
      }
      setSelection({ text: instance.state.doc.textBetween(from, to, ' '), from, to });
    },
  });

  /**
   * Synchronise the editor with the stored draft. The editor is an external
   * system, so this belongs in an effect — and it deliberately avoids
   * setting React state.
   */
  useEffect(() => {
    if (!draft) return;
    if (loadedDraftId.current === draft.id) return;
    loadedDraftId.current = draft.id;
    contentRef.current = draft.content;
    try {
      editor.commands.setContent(JSON.parse(draft.content) as object);
    } catch {
      editor.commands.setContent(draft.content);
    }
  }, [draft, editor]);

  const persist = useCallback(
    (nextContent: string) => {
      if (!draft) return;
      setSaveState('saving');
      saveDraft.mutate(
        { id: draft.id, content: nextContent, baseVersion: draft.currentVersion },
        {
          onSuccess: () => {
            setSaveState('saved');
            window.localStorage.removeItem(`oppulse:draft:${draft.id}`);
          },
          onError: () => {
            setSaveState('error');
            setLocalBackup(nextContent);
            window.localStorage.setItem(`oppulse:draft:${draft.id}`, nextContent);
          },
        },
      );
    },
    [draft, saveDraft],
  );

  // Debounced autosave.
  useEffect(() => {
    if (!draft) return;
    if (contentRef.current === draft.content) return;
    const timer = window.setTimeout(() => {
      persist(contentRef.current);
    }, 800);
    return () => window.clearTimeout(timer);
  }, [revision, draft, persist]);

  if (isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-[32rem]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        {error instanceof ApiError && error.code === 'NOT_FOUND' ? (
          <NotFoundState />
        ) : (
          <ErrorState error={error} onRetry={() => void refetch()} />
        )}
      </div>
    );
  }

  const proposal = draft.pendingProposal;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Button asChild variant="ghost" size="sm" className="self-start">
            <Link to={`/applications/${draft.applicationId}`}>
              <ArrowLeft aria-hidden="true" className="size-4" />
              Back to application
            </Link>
          </Button>
          <h1 className="text-page-title font-semibold tracking-tight text-text">{draft.title}</h1>
        </div>

        <div className="flex items-center gap-2">
          <AutosaveIndicator state={saveState} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setVersionPanelOpen((open) => !open)}
            aria-expanded={versionPanelOpen}
          >
            <History aria-hidden="true" className="size-4" />
            History
          </Button>
          <Button
            size="sm"
            onClick={() => persist(contentRef.current)}
            loading={saveDraft.isPending}
            loadingLabel="Saving…"
            disabled={saveState === 'saving'}
          >
            <Save aria-hidden="true" className="size-4" />
            Save
          </Button>
        </div>
      </div>

      {saveState === 'error' ? (
        <div role="alert" className="rounded-card border border-danger/30 bg-danger-surface p-4">
          <p className="text-sm font-semibold text-text">Changes not saved</p>
          <p className="mt-1 text-sm text-text-muted">
            Your text is preserved on this device. Copy it before you leave, then try saving again.
          </p>
          <div className="mt-2 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (!window.isSecureContext) {
                  toast({
                    tone: 'warning',
                    title: 'Clipboard access is unavailable',
                    description: 'Select the text and copy it manually — it is still on this page.',
                  });
                  return;
                }
                void navigator.clipboard.writeText(localBackup || contentRef.current);
                toast({ tone: 'info', title: 'Copied to your clipboard' });
              }}
            >
              Copy my text
            </Button>
            <Button
              size="sm"
              loading={saveDraft.isPending}
              loadingLabel="Saving…"
              onClick={() => persist(contentRef.current)}
            >
              <RefreshCw aria-hidden="true" className="size-4" />
              Try saving again
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[16rem_minmax(0,1fr)_20rem]">
        <Card className="flex flex-col gap-3 p-4">
          <h2 className="text-sm font-semibold text-text">Context</h2>
          <p className="text-meta text-text-muted">
            The assistant uses the opportunity details and your confirmed profile facts. It never
            invents an achievement.
          </p>
          <div className="flex flex-col gap-2">
            <span className="text-meta font-medium text-text-muted">Document</span>
            <span className="text-sm text-text">{draft.title}</span>
            <span className="text-meta text-text-muted">Version {draft.currentVersion}</span>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-meta font-medium text-text-muted">Rules</span>
            <ul className="flex list-disc flex-col gap-1 pl-4 text-meta text-text-muted">
              <li>Never claim an achievement that is not in your confirmed facts.</li>
              <li>Never write as a recommender.</li>
              <li>Show a diff before anything is applied.</li>
            </ul>
          </div>
        </Card>

        <Card className="flex min-h-[32rem] flex-col overflow-hidden">
          <EditorToolbar editor={editor} />
          <div className="scrollbar-subtle flex-1 overflow-y-auto">
            <EditorContent editor={editor} />
          </div>
        </Card>

        <Card className="flex flex-col gap-3 p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-text">
            <Sparkles aria-hidden="true" className="size-4 text-primary" />
            Writing assistant
          </h2>

          {proposal ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Badge tone="info">Proposal ready</Badge>
                <span className="text-meta text-text-muted">
                  against version {proposal.baseVersion}
                </span>
              </div>

              <p className="text-sm text-text">{proposal.summary}</p>

              {proposal.unsupportedClaims.length > 0 ? (
                <div className="rounded-button bg-warning-surface p-3">
                  <p className="flex items-center gap-1.5 text-meta font-medium text-warning">
                    <AlertTriangle aria-hidden="true" className="size-3.5" />
                    Unsupported claim
                  </p>
                  <ul className="mt-1 flex list-disc flex-col gap-1 pl-4 text-meta text-warning/90">
                    {proposal.unsupportedClaims.map((claim) => (
                      <li key={claim}>{claim}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  loading={acceptProposal.isPending}
                  loadingLabel="Accepting…"
                  onClick={() =>
                    acceptProposal.mutate(
                      { id: draft.id, proposalId: proposal.id },
                      {
                        onSuccess: () => {
                          setShowDiff(false);
                          toast({
                            tone: 'success',
                            title: 'Revision accepted',
                            description:
                              'It was saved as a new version. The previous one is still recoverable.',
                          });
                        },
                      },
                    )
                  }
                >
                  <Check aria-hidden="true" className="size-4" />
                  Accept
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowDiff((open) => !open)}>
                  Review changes
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  loading={rejectProposal.isPending}
                  loadingLabel="Rejecting…"
                  onClick={() =>
                    rejectProposal.mutate(
                      { id: draft.id, proposalId: proposal.id },
                      {
                        onSuccess: () =>
                          toast({
                            tone: 'info',
                            title: 'Proposal discarded',
                            description: 'Your document is unchanged.',
                          }),
                      },
                    )
                  }
                >
                  <X aria-hidden="true" className="size-4" />
                  Reject
                </Button>
              </div>

              {showDiff ? (
                <DiffViewer
                  before={extractText(draft.content)}
                  after={extractText(proposal.content)}
                />
              ) : null}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {selection ? (
                <div className="flex flex-col gap-2 rounded-button border border-primary/30 bg-primary/5 p-3">
                  <p className="text-meta font-medium text-primary">Revising a selection</p>
                  <blockquote className="scrollbar-subtle max-h-24 overflow-y-auto border-l-2 border-primary/40 pl-3 text-sm text-text-muted italic">
                    “{selection.text}”
                  </blockquote>
                  <button
                    type="button"
                    onClick={() => {
                      editor.commands.focus();
                      setSelection(null);
                    }}
                    className="self-start text-meta font-medium text-text-muted underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                  >
                    Revise the whole document instead
                  </button>
                </div>
              ) : null}

              <label htmlFor="writing-instruction" className="text-sm font-medium text-text">
                {selection ? 'What should change in this selection?' : 'What should change?'}
              </label>
              <Textarea
                id="writing-instruction"
                value={instruction}
                onChange={(event) => setInstruction(event.target.value)}
                placeholder={
                  selection
                    ? 'Make this clearer and more specific, without inventing achievements.'
                    : 'Make this paragraph more specific to the host laboratory, without inventing achievements.'
                }
                rows={5}
              />
              <Button
                size="sm"
                loading={createProposal.isPending}
                loadingLabel="Preparing…"
                disabled={!instruction.trim()}
                onClick={() =>
                  createProposal.mutate(
                    {
                      id: draft.id,
                      instruction,
                      ...(selection ? { selectedText: selection.text } : {}),
                    },
                    {
                      onSuccess: () => {
                        setInstruction('');
                        toast({
                          tone: 'info',
                          title: 'Proposal ready',
                          description: selection
                            ? 'It rewrites only the text you selected. Review the diff before accepting it.'
                            : 'Review the diff before accepting it.',
                        });
                      },
                    },
                  )
                }
              >
                <Sparkles aria-hidden="true" className="size-4" />
                {selection ? 'Propose a revision for this selection' : 'Propose a revision'}
              </Button>
              <p className="text-meta text-text-muted">
                A proposal is never applied automatically. You review the diff and decide.
              </p>
            </div>
          )}
        </Card>
      </div>

      {versionPanelOpen ? (
        <Card className="flex flex-col gap-3 p-5">
          <h2 className="text-card-title font-semibold text-text">Version history</h2>
          <ul className="flex flex-col gap-2">
            {[...draft.versions].reverse().map((version) => (
              <li
                key={version.version}
                className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-border p-3"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-text">Version {version.version}</span>
                  <span className="text-meta text-text-muted">
                    {new Date(version.createdAt).toLocaleString('en-GB', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                    {version.summary ? ` — ${version.summary}` : ''}
                  </span>
                </div>
                <Badge tone={version.source === 'ai_accepted' ? 'info' : 'neutral'}>
                  {version.source === 'ai_accepted'
                    ? 'Accepted revision'
                    : version.source === 'user'
                      ? 'Your edit'
                      : version.source === 'created'
                        ? 'Created'
                        : 'Imported'}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

function AutosaveIndicator({ state }: { state: SaveState }) {
  const label: Record<SaveState, string> = {
    idle: 'All changes saved',
    saving: 'Saving…',
    saved: 'Saved',
    error: 'Not saved',
  };
  const tone: Record<SaveState, 'text-success' | 'text-text-muted' | 'text-danger'> = {
    idle: 'text-text-muted',
    saving: 'text-text-muted',
    saved: 'text-success',
    error: 'text-danger',
  };

  return (
    <span className={`text-meta ${tone[state]}`} role="status" aria-live="polite">
      {label[state]}
    </span>
  );
}

function EditorToolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  const buttons = [
    {
      label: 'Bold',
      run: () => editor.chain().focus().toggleBold().run(),
      active: editor.isActive('bold'),
    },
    {
      label: 'Italic',
      run: () => editor.chain().focus().toggleItalic().run(),
      active: editor.isActive('italic'),
    },
    {
      label: 'Bullet list',
      run: () => editor.chain().focus().toggleBulletList().run(),
      active: editor.isActive('bulletList'),
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-border p-2">
      {buttons.map((button) => (
        <button
          key={button.label}
          type="button"
          onClick={button.run}
          aria-pressed={button.active}
          className={
            'min-h-11 rounded-button px-3 text-sm text-text ' +
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring ' +
            (button.active ? 'bg-primary/10 text-primary' : 'hover:bg-surface-subtle')
          }
        >
          {button.label}
        </button>
      ))}
    </div>
  );
}

/** Extracts readable text from a Tiptap JSON string for the diff view. */
function extractText(documentJson: string): string {
  try {
    const parsed = JSON.parse(documentJson) as {
      content?: { content?: { text?: string }[] }[];
    };
    const paragraphs: string[] = [];
    for (const node of parsed.content ?? []) {
      const text = (node.content ?? []).map((child) => child.text ?? '').join('');
      paragraphs.push(text);
    }
    return paragraphs.join('\n\n');
  } catch {
    return documentJson;
  }
}
