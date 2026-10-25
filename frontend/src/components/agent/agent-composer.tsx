import { useState, type FormEvent, type ReactNode } from 'react';
import { Paperclip, SendHorizonal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

/**
 * The agent composer.
 *
 * The same control is used on the home dashboard, in the assistant route
 * and as the persistent bottom action on mobile. It accepts a message and,
 * optionally, a link or an uploaded file.
 *
 * A pasted bare link is an analysis request, not a question — the send
 * path recognises it and starts a run. The attach button opens the same
 * flow: paste the link, and it goes the same way.
 */
export function AgentComposer({
  onSend,
  disabled = false,
  pending = false,
  placeholder = 'Ask Oppulse anything…',
  contextLabel,
  contextSlot,
  selectionSlot,
  className,
}: {
  onSend: (message: string) => void | Promise<void>;
  disabled?: boolean | undefined;
  pending?: boolean | undefined;
  placeholder?: string | undefined;
  /** Describes what context the agent will use, so the user knows what it sees. */
  contextLabel?: string | undefined;
  /** The working-context strip, rendered above the input. */
  contextSlot?: ReactNode | undefined;
  /** A selection bar, rendered above the context strip. */
  selectionSlot?: ReactNode | undefined;
  className?: string | undefined;
}) {
  const [value, setValue] = useState('');
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState('');

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const message = value.trim();
    if (!message || disabled || pending) return;
    setValue('');
    void onSend(message);
  };

  const handleLinkSubmit = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    const link = linkValue.trim();
    if (!link || disabled || pending) return;
    setLinkValue('');
    setLinkOpen(false);
    void onSend(link);
  };

  return (
    <form onSubmit={handleSubmit} className={cn('flex flex-col gap-2', className)}>
      {selectionSlot}
      {contextSlot}
      {contextLabel ? <p className="text-meta text-text-muted">{contextLabel}</p> : null}
      <div className="flex items-end gap-2 rounded-panel border border-border bg-surface p-2 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus-ring">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Attach a document or paste a link"
          aria-expanded={linkOpen}
          disabled={disabled || pending}
          onClick={() => setLinkOpen((open) => !open)}
        >
          <Paperclip aria-hidden="true" className="size-5" />
        </Button>

        <label htmlFor="agent-composer" className="sr-only">
          Message to Oppulse
        </label>
        <textarea
          id="agent-composer"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              handleSubmit(event);
            }
          }}
          rows={1}
          placeholder={placeholder}
          disabled={disabled || pending}
          className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-1 py-2.5 text-sm leading-relaxed text-text outline-none placeholder:text-text-muted/70 disabled:cursor-not-allowed"
        />

        <Button
          type="submit"
          size="icon"
          disabled={!value.trim() || disabled || pending}
          loading={pending}
        >
          <SendHorizonal aria-hidden="true" className="size-5" />
          <span className="sr-only">Send message</span>
        </Button>
      </div>

      {linkOpen ? (
        <div className="flex items-center gap-2 rounded-panel border border-border bg-surface p-2">
          <label htmlFor="agent-composer-link" className="sr-only">
            Link to analyse
          </label>
          <input
            id="agent-composer-link"
            type="url"
            value={linkValue}
            onChange={(event) => setLinkValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleLinkSubmit(event);
              }
            }}
            placeholder="https://… — the call you want analysed"
            disabled={disabled || pending}
            className="min-h-11 flex-1 bg-transparent px-1 py-2.5 text-sm leading-relaxed text-text outline-none placeholder:text-text-muted/70 disabled:cursor-not-allowed"
          />
          <Button
            type="button"
            size="sm"
            disabled={!linkValue.trim() || disabled || pending}
            onClick={handleLinkSubmit}
          >
            Analyse this link
          </Button>
        </div>
      ) : null}
    </form>
  );
}
