import { Button } from '@/components/ui/button';
import { useAgent } from '@/lib/agent-context';
import { actionChipsFor } from '@/lib/action-chips';

/**
 * Context-aware action chips.
 *
 * The suggestions change with what the student is looking at, so the agent
 * always offers the actions that make sense right now rather than a fixed
 * list of demonstrations.
 */
export function ActionChips({ className }: { className?: string }) {
  const { context, send, runAction, pending } = useAgent();
  const chips = actionChipsFor(context);

  return (
    <div className={className}>
      <p className="mb-2 text-meta font-medium text-text-muted">Try</p>
      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <Button
            key={chip.id}
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => {
              if (pending) return;
              if (chip.action) {
                void runAction(chip.action);
                return;
              }
              if (chip.message) void send(chip.message);
            }}
          >
            {chip.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
