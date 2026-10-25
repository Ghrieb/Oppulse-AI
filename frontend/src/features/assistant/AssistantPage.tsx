import { Bot, Compass, Link2, MessageSquareText, Target } from 'lucide-react';
import { ActionChips } from '@/components/agent/action-chips';
import { AgentConversation } from '@/components/agent/agent-conversation';
import { AgentComposer } from '@/components/agent/agent-composer';
import { ApprovalBoundaryNote } from '@/components/agent/assistant-blocks';
import { ContextStrip } from '@/components/agent/context-strip';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/feedback/banners';
import { useAgent } from '@/lib/agent-context';

/**
 * Context-aware assistant.
 *
 * The same conversation the home panel shows, with the working context made
 * explicit and the agent's answers rendered as cards that can be acted on.
 */
export function AssistantPage() {
  const { send, pending } = useAgent();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="AI assistant"
        description="Ask about your profile, an opportunity, or your application. The assistant answers from the evidence stored for each of them."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="flex min-h-[36rem] flex-col overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-border p-5">
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/12 text-primary"
              >
                <Bot className="size-5" />
              </span>
              <div className="flex flex-col gap-1">
                <h2 className="text-card-title font-semibold text-text">Ask your agent</h2>
                <p className="text-sm text-text-muted">
                  I work from your confirmed profile, the sources the agent has retrieved, and the
                  application you are working on.
                </p>
              </div>
            </div>
          </div>

          <div className="flex scrollbar-subtle flex-1 flex-col gap-4 overflow-y-auto p-5">
            <AgentConversation
              emptyState={
                <div className="flex flex-col gap-4">
                  <p className="text-sm text-text-muted">
                    Try one of these, or write your own question.
                  </p>
                  <ActionChips />
                </div>
              }
            />
          </div>

          <div className="flex flex-col gap-3 border-t border-border p-4">
            <AgentComposer
              onSend={send}
              pending={pending}
              placeholder="Ask about eligibility, funding, or your application…"
              contextSlot={<ContextStrip />}
            />
            <ApprovalBoundaryNote />
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-3 p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-text">
              <MessageSquareText aria-hidden="true" className="size-4 text-text-muted" />
              What I can do
            </h2>
            <ul className="flex flex-col gap-2 text-sm text-text-muted">
              <li className="flex items-start gap-2">
                <Compass aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                Explain why an opportunity matches your profile, and what is still unverified.
              </li>
              <li className="flex items-start gap-2">
                <Target aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                Turn a goal into a mission and start a research run.
              </li>
              <li className="flex items-start gap-2">
                <Link2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                Analyse a link or an announcement you paste in.
              </li>
            </ul>
          </Card>

          <Card className="flex flex-col gap-2 p-4">
            <h2 className="text-sm font-semibold text-text">Context in use</h2>
            <p className="text-meta text-text-muted">
              Your confirmed profile facts, the retrieved sources, and the drafts you have authored.
              Nothing else.
            </p>
            <Button asChild variant="ghost" size="sm" className="self-start">
              <a href="/profile">Review what Oppulse knows</a>
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
