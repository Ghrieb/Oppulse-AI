import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import {
  AlignCenter,
  AlignLeft,
  ArrowLeft,
  Bold,
  Check,
  Heading1,
  Heading2,
  History,
  Italic,
  Link2,
  List,
  ListOrdered,
  MessageSquareText,
  Minimize2,
  Quote,
  Redo2,
  RefreshCw,
  RemoveFormatting,
  Save,
  Sparkles,
  Strikethrough,
  Target,
  Underline as UnderlineIcon,
  Undo2,
  Wand2,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/tooltip';
import { DiffViewer } from '@/components/ui/diff-viewer';
import { ErrorState, NotFoundState } from '@/components/feedback/states';
import { OppulseMascot } from '@/components/agent/oppulse-mascot';
import { ApiError } from '@/lib/api/errors';
import { useAgent } from '@/lib/agent-context';
import { cn } from '@/lib/cn';
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
 * The one-click revisions the assistant offers. Each is a real proposal
 * against the current draft — nothing is applied without a diff review
 * (ADR-006).
 */
const QUICK_ACTIONS: { id: string; label: string; icon: LucideIcon; instruction: string }[] = [
  {
    id: 'improve',
    label: 'Improve this section',
    icon: Wand2,
    instruction:
      'Improve this section for clarity and impact, using only my confirmed facts.',
  },
  {
    id: 'concise',
    label: 'Make it more concise',
    icon: Minimize2,
    instruction: 'Make this more concise without losing meaning. Do not invent achievements.',
  },
  {
    id: 'adjust',
    label: 'Adjust for this programme',
    icon: Target,
    instruction:
      'Adjust this draft for the specific programme, using only my confirmed facts.',
  },
];

/**
 * Writing studio.
 *
 * The AI never overwrites the document. It returns a proposal, the student
 * reviews a diff, and acceptance creates a new version (ADR-006).
 */
export default function WritingStudioPage() {
  const { draftId } = useParams<{ draftId: string }>();
  const navigate = useNavigate();
  const { data: draft, isPending, error, refetch } = useDraft(draftId ?? null);
  const saveDraft = useSaveDraft();
  const createProposal = useCreateProposal();
  const acceptProposal = useAcceptProposal();
  const rejectProposal = useRejectProposal();
  const { toast } = useToast();
  const { setContext } = useAgent();

  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [instruction, setInstruction] = useState('');
  const [customOpen, setCustomOpen] = useState(false);
  const [versionPanelOpen, setVersionPanelOpen] = useState(true);
  /** The editor is the source of truth for the text; the ref mirrors it. */
  const contentRef = useRef('');
  const loadedDraftId = useRef<string | null>(null);
  const instructionRef = useRef<HTMLTextAreaElement>(null);
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
      StarterKit.configure({
        // The link prompt validates the address itself; clicks never open
        // links while the student is still editing.
        link: { openOnClick: false, autolink: true },
      }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
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
  const proposalBusy = createProposal.isPending || Boolean(proposal);

  const requestProposal = (nextInstruction: string) => {
    createProposal.mutate(
      {
        id: draft.id,
        instruction: nextInstruction,
        ...(selection ? { selectedText: selection.text } : {}),
      },
      {
        onSuccess: () => {
          setInstruction('');
          setCustomOpen(false);
          toast({
            tone: 'info',
            title: 'Proposal ready',
            description: selection
              ? 'It rewrites only the text you selected. Review the diff before accepting it.'
              : 'Review the diff before accepting it.',
          });
        },
        onError: () =>
          toast({
            tone: 'error',
            title: 'We could not prepare a proposal',
            description: 'Nothing was changed. Try again.',
          }),
      },
    );
  };

  const openCustomRequest = () => {
    setCustomOpen(true);
    window.setTimeout(() => instructionRef.current?.focus(), 0);
  };

  const askOppulse = () => {
    setContext({ draftId: draft.id });
    void navigate('/assistant');
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <Button asChild variant="ghost" size="sm" className="-ml-2 self-start">
            <Link to={`/applications/${draft.applicationId}`}>
              <ArrowLeft aria-hidden="true" className="size-4" />
              Back to application
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-page-title font-semibold tracking-tight text-text">
              {draft.title}
            </h1>
            <Badge tone="info">Version {draft.currentVersion}</Badge>
            <AutosaveIndicator state={saveState} />
          </div>
        </div>

        <div className="flex items-center gap-2">
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
          <Button
            asChild
            variant="ghost"
            size="icon"
            aria-label="Close the studio and return to your application"
          >
            <Link to={`/applications/${draft.applicationId}`}>
              <X aria-hidden="true" className="size-5" />
            </Link>
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

      <div className="flex flex-col gap-4 xl:flex-row">
        <nav
          aria-label="Studio tools"
          className="sticky top-6 hidden h-fit flex-col gap-1 self-start rounded-panel border border-border bg-surface p-1.5 md:flex"
        >
          <Button asChild variant="ghost" size="icon" title="Back to application">
            <Link
              to={`/applications/${draft.applicationId}`}
              aria-label="Back to application"
            >
              <ArrowLeft aria-hidden="true" className="size-5" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Save now"
            aria-label="Save now"
            disabled={saveDraft.isPending || saveState === 'saving'}
            onClick={() => persist(contentRef.current)}
          >
            <Save aria-hidden="true" className="size-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Version history"
            aria-label="Toggle version history"
            aria-pressed={versionPanelOpen}
            onClick={() => setVersionPanelOpen((open) => !open)}
          >
            <History aria-hidden="true" className="size-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="AI assistant"
            aria-label="Focus the AI assistant"
            onClick={openCustomRequest}
          >
            <Sparkles aria-hidden="true" className="size-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Ask Oppulse"
            aria-label="Ask Oppulse in the assistant"
            onClick={askOppulse}
          >
            <MessageSquareText aria-hidden="true" className="size-5" />
          </Button>
        </nav>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <Card className="flex min-h-[32rem] flex-col overflow-hidden">
            <EditorToolbar
              editor={editor}
              onLinkRejected={() =>
                toast({
                  tone: 'warning',
                  title: 'That address is not a link',
                  description: 'Enter a full address, including https://',
                })
              }
            />
            <div className="scrollbar-subtle flex-1 overflow-y-auto">
              <EditorContent editor={editor} />
            </div>
          </Card>

          {proposal ? (
            <Card className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-card-title font-semibold text-text">
                  <Sparkles aria-hidden="true" className="size-4 text-primary" />
                  Proposed changes
                </h2>
                <div className="flex items-center gap-2">
                  <Badge tone="info">Proposal ready</Badge>
                  <span className="text-meta text-text-muted">
                    against version {proposal.baseVersion}
                  </span>
                </div>
              </div>

              <p className="mt-3 text-sm text-text">{proposal.summary}</p>

              {proposal.unsupportedClaims.length > 0 ? (
                <div className="mt-3 rounded-button bg-warning-surface p-3">
                  <p className="flex items-center gap-1.5 text-meta font-medium text-warning">
                    <span aria-hidden="true">⚠</span>
                    Unsupported claim
                  </p>
                  <ul className="mt-1 flex list-disc flex-col gap-1 pl-4 text-meta text-warning/90">
                    {proposal.unsupportedClaims.map((claim) => (
                      <li key={claim}>{claim}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="mt-4">
                <DiffViewer
                  before={extractText(draft.content)}
                  after={extractText(proposal.content)}
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                <Button
                  size="sm"
                  loading={acceptProposal.isPending}
                  loadingLabel="Accepting…"
                  onClick={() =>
                    acceptProposal.mutate(
                      { id: draft.id, proposalId: proposal.id },
                      {
                        onSuccess: () => {
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
                <Button
                  variant="outline"
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
                <p className="self-center text-meta text-text-muted">
                  Accepting creates a new version. Your current text stays recoverable.
                </p>
              </div>
            </Card>
          ) : null}
        </div>

        <aside className="flex w-full flex-col gap-4 xl:sticky xl:top-6 xl:h-fit xl:w-[20rem] xl:shrink-0">
          <Card className="p-4">
            <div className="flex items-start gap-3">
              <OppulseMascot size="promo" className="-mt-1 -ml-1 shrink-0" />
              <div className="min-w-0">
                <h2 className="flex items-center gap-1.5 text-sm font-semibold text-text">
                  <Sparkles aria-hidden="true" className="size-4 text-primary" />
                  AI assistant
                </h2>
                <p className="mt-1 text-meta text-text-muted">
                  I can help you improve your content, make it more concise, or adjust it for a
                  specific programme — using the opportunity details and your confirmed facts. I
                  never invent an achievement.
                </p>
              </div>
            </div>

            {selection ? (
              <div className="mt-3 flex flex-col gap-2 rounded-button border border-primary/30 bg-primary/5 p-3">
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

            <div className="mt-3 flex flex-col gap-2">
              {QUICK_ACTIONS.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.id}
                    type="button"
                    disabled={proposalBusy}
                    onClick={() => requestProposal(action.instruction)}
                    className="flex min-h-11 items-center gap-2.5 rounded-button border border-border bg-surface px-3 text-left text-sm font-medium text-text transition-colors hover:border-primary/40 hover:bg-primary/[0.03] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:pointer-events-none disabled:opacity-55"
                  >
                    <Icon aria-hidden="true" className="size-4 shrink-0 text-primary" />
                    {createProposal.isPending ? 'Preparing…' : action.label}
                  </button>
                );
              })}
              <button
                type="button"
                disabled={proposalBusy}
                onClick={openCustomRequest}
                className="flex min-h-11 items-center gap-2.5 rounded-button border border-border bg-surface px-3 text-left text-sm font-medium text-text transition-colors hover:border-primary/40 hover:bg-primary/[0.03] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:pointer-events-none disabled:opacity-55"
              >
                <MessageSquareText aria-hidden="true" className="size-4 shrink-0 text-primary" />
                Custom request
              </button>
            </div>

            {proposal ? (
              <p className="mt-3 text-meta text-text-muted">
                Review or discard the current proposal before asking for another.
              </p>
            ) : null}

            {customOpen || selection ? (
              <div className="mt-4 flex flex-col gap-2 border-t border-border pt-3">
                <label htmlFor="writing-instruction" className="text-sm font-medium text-text">
                  {selection ? 'What should change in this selection?' : 'What should change?'}
                </label>
                <Textarea
                  id="writing-instruction"
                  ref={instructionRef}
                  value={instruction}
                  onChange={(event) => setInstruction(event.target.value)}
                  placeholder={
                    selection
                      ? 'Make this clearer and more specific, without inventing achievements.'
                      : 'Make this paragraph more specific to the host laboratory, without inventing achievements.'
                  }
                  rows={4}
                />
                <Button
                  size="sm"
                  loading={createProposal.isPending}
                  loadingLabel="Preparing…"
                  disabled={!instruction.trim() || Boolean(proposal)}
                  onClick={() => requestProposal(instruction)}
                >
                  <Sparkles aria-hidden="true" className="size-4" />
                  {selection ? 'Propose a revision for this selection' : 'Propose a revision'}
                </Button>
                <p className="text-meta text-text-muted">
                  A proposal is never applied automatically. You review the diff and decide.
                </p>
              </div>
            ) : null}

            <div className="mt-4 border-t border-border pt-3">
              <span className="text-meta font-medium text-text-muted">Rules</span>
              <ul className="mt-1 flex list-disc flex-col gap-1 pl-4 text-meta text-text-muted">
                <li>Never claim an achievement that is not in your confirmed facts.</li>
                <li>Never write as a recommender.</li>
                <li>Show a diff before anything is applied.</li>
              </ul>
            </div>
          </Card>

          {versionPanelOpen ? (
            <Card className="p-4">
              <h2 className="flex items-center gap-2 text-card-title font-semibold text-text">
                <History aria-hidden="true" className="size-4 text-text-muted" />
                Version history
              </h2>
              <ul className="mt-3 flex flex-col gap-2">
                {[...draft.versions].reverse().map((version) => (
                  <li
                    key={version.version}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-border p-3"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-text">
                        Version {version.version}
                        {version.version === draft.currentVersion ? (
                          <span className="text-meta font-normal text-text-muted"> (current)</span>
                        ) : null}
                      </span>
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
              <p className="mt-3 text-meta text-text-muted">
                Every accepted revision creates a new version, so an earlier one is never lost.
              </p>
            </Card>
          ) : null}
        </aside>
      </div>
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

interface ToolbarItem {
  label: string;
  icon: LucideIcon;
  active?: boolean;
  disabled?: boolean;
  run: () => void;
}

/**
 * The full formatting toolbar.
 *
 * Every control maps to a real editor command; nothing here is decorative.
 * Active state is exposed with `aria-pressed` so the current formatting is
 * not conveyed by colour alone.
 */
function EditorToolbar({
  editor,
  onLinkRejected,
}: {
  editor: ReturnType<typeof useEditor>;
  onLinkRejected: () => void;
}) {
  const toggleLink = () => {
    if (editor.isActive('link')) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    const href = window.prompt('Link address', 'https://');
    if (!href) return;
    if (!/^https?:\/\/\S+\.\S+/.test(href.trim())) {
      onLinkRejected();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: href.trim() }).run();
  };

  const groups: ToolbarItem[][] = [
    [
      {
        label: 'Bold',
        icon: Bold,
        active: editor.isActive('bold'),
        run: () => editor.chain().focus().toggleBold().run(),
      },
      {
        label: 'Italic',
        icon: Italic,
        active: editor.isActive('italic'),
        run: () => editor.chain().focus().toggleItalic().run(),
      },
      {
        label: 'Underline',
        icon: UnderlineIcon,
        active: editor.isActive('underline'),
        run: () => editor.chain().focus().toggleUnderline().run(),
      },
      {
        label: 'Strikethrough',
        icon: Strikethrough,
        active: editor.isActive('strike'),
        run: () => editor.chain().focus().toggleStrike().run(),
      },
    ],
    [
      {
        label: 'Heading 1',
        icon: Heading1,
        active: editor.isActive('heading', { level: 1 }),
        run: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
      },
      {
        label: 'Heading 2',
        icon: Heading2,
        active: editor.isActive('heading', { level: 2 }),
        run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      },
      {
        label: 'Quote',
        icon: Quote,
        active: editor.isActive('blockquote'),
        run: () => editor.chain().focus().toggleBlockquote().run(),
      },
      {
        label: 'Bullet list',
        icon: List,
        active: editor.isActive('bulletList'),
        run: () => editor.chain().focus().toggleBulletList().run(),
      },
      {
        label: 'Numbered list',
        icon: ListOrdered,
        active: editor.isActive('orderedList'),
        run: () => editor.chain().focus().toggleOrderedList().run(),
      },
    ],
    [
      {
        label: 'Align left',
        icon: AlignLeft,
        active: editor.isActive({ textAlign: 'left' }),
        run: () => editor.chain().focus().setTextAlign('left').run(),
      },
      {
        label: 'Align centre',
        icon: AlignCenter,
        active: editor.isActive({ textAlign: 'center' }),
        run: () => editor.chain().focus().setTextAlign('center').run(),
      },
    ],
    [
      {
        label: 'Link',
        icon: Link2,
        active: editor.isActive('link'),
        run: toggleLink,
      },
      {
        label: 'Clear formatting',
        icon: RemoveFormatting,
        run: () => editor.chain().focus().clearNodes().unsetAllMarks().run(),
      },
    ],
    [
      {
        label: 'Undo',
        icon: Undo2,
        disabled: !editor.can().undo(),
        run: () => editor.chain().focus().undo().run(),
      },
      {
        label: 'Redo',
        icon: Redo2,
        disabled: !editor.can().redo(),
        run: () => editor.chain().focus().redo().run(),
      },
    ],
  ];

  return (
    <div
      role="toolbar"
      aria-label="Text formatting"
      className="flex flex-wrap items-center gap-0.5 border-b border-border p-1.5"
    >
      {groups.map((group, groupIndex) => (
        <Fragment key={groupIndex}>
          {groupIndex > 0 ? (
            <span aria-hidden="true" className="mx-1 h-6 w-px bg-border" />
          ) : null}
          {group.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                title={item.label}
                aria-label={item.label}
                aria-pressed={item.active}
                disabled={item.disabled}
                onClick={item.run}
                className={cn(
                  'grid size-11 place-items-center rounded-button text-text',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
                  'disabled:pointer-events-none disabled:opacity-40',
                  item.active ? 'bg-primary/10 text-primary' : 'hover:bg-surface-subtle',
                )}
              >
                <Icon aria-hidden="true" className="size-4" />
              </button>
            );
          })}
        </Fragment>
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
