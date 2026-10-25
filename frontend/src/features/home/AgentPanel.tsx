import { Link2, Target, UserPlus } from 'lucide-react';
import { ActionChips } from '@/components/agent/action-chips';
import { AgentConversation } from '@/components/agent/agent-conversation';
import { AgentComposer } from '@/components/agent/agent-composer';
import { ApprovalBoundaryNote } from '@/components/agent/assistant-blocks';
import { ContextStrip } from '@/components/agent/context-strip';
import { OppulseAvatar } from '@/components/agent/oppulse-avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAgent } from '@/lib/agent-context';
import { useSession } from '@/lib/queries';

/**
 * The agent on the home workspace.
 *
 * It is the *same* thread as the assistant route, so a student who starts
 * asking a question on the dashboard finds it waiting when they open the
 * assistant.
 */
export function AgentPanel() {
  const { send, pending } = useAgent();
  const { data: session } = useSession();
  const firstName = session?.user.fullName.split(' ')[0] ?? 'there';

  return (
    <Card className="flex min-h-[32rem] flex-col overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-border p-5">
        <div className="flex items-start gap-3">
          <OppulseAvatar />
          <div className="flex flex-col gap-1">
            <h2 className="text-card-title font-semibold text-text">
              Oppulse, your opportunity agent
            </h2>
            <p className="text-sm text-text-muted">
              Hi {firstName}! I’ll help you find programmes that fit your goals, understand the
              requirements, and turn promising ones into an application plan.
            </p>
          </div>
        </div>
      </div>

      <div className="flex scrollbar-subtle flex-1 flex-col gap-4 overflow-y-auto p-5">
        <AgentConversation
          emptyState={
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => void send('Find fully funded opportunities suited to me.')}
                >
                  <Target aria-hidden="true" className="size-4" />
                  Find opportunities for me
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => void send('Analyse this opportunity link:')}
                >
                  <Link2 aria-hidden="true" className="size-4" />
                  Analyse a link
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => void send('Help me prepare an application.')}
                >
                  <UserPlus aria-hidden="true" className="size-4" />
                  Prepare an application
                </Button>
              </div>
              <ActionChips />
            </div>
          }
        />
      </div>

      <div className="flex flex-col gap-3 border-t border-border p-4">
        <AgentComposer
          onSend={send}
          pending={pending}
          placeholder="Find programmes, analyse a call, or ask a question…"
          contextSlot={<ContextStrip />}
        />
        <ApprovalBoundaryNote />
      </div>
    </Card>
  );
}
