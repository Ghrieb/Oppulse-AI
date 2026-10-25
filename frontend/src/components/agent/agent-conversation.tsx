import type { ReactNode } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { AssistantBlocks } from './assistant-blocks';
import { useAgent } from '@/lib/agent-context';
import { cn } from '@/lib/cn';

/**
 * The conversation.
 *
 * One component, two surfaces: the home panel and the assistant route read
 * the same thread, so a student never loses what they were discussing by
 * moving between them.
 */
export function AgentConversation({
  emptyState,
  className,
}: {
  emptyState?: ReactNode;
  className?: string;
}) {
  const { messages, pending, error } = useAgent();

  if (messages.length === 0 && !pending) {
    return <div className={className}>{emptyState}</div>;
  }

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {messages.map((message) =>
        message.role === 'user' ? (
          <div key={message.id} className="ml-auto max-w-[85%]">
            <div className="rounded-panel rounded-br-sm bg-primary px-4 py-2.5 text-sm text-white">
              {message.content}
            </div>
          </div>
        ) : (
          <div key={message.id} className="flex max-w-[95%] flex-col gap-2">
            {message.blocks && message.blocks.length > 0 ? (
              <AssistantBlocks blocks={message.blocks} />
            ) : message.content ? (
              <div className="rounded-panel rounded-bl-sm bg-surface-subtle px-4 py-2.5 text-sm text-text">
                {message.content}
              </div>
            ) : null}
          </div>
        ),
      )}

      {pending ? (
        <div className="flex items-center gap-2 text-meta text-text-muted">
          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          Oppulse is working on it.
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-button border border-danger/30 bg-danger-surface px-3 py-2 text-sm text-danger"
        >
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {error}
        </div>
      ) : null}
    </div>
  );
}
