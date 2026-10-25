import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command } from 'cmdk';
import { Search } from 'lucide-react';
import { COMMAND_ITEMS } from './nav';
import { cn } from '@/lib/cn';

/**
 * Global command palette.
 *
 * A fast entry point for experienced users, and a genuinely usable search
 * for everyone else (spec §2.2).
 */
export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const handleOpenChange = (next: boolean) => {
    // Reset the query when the palette closes, so it reopens empty.
    if (!next) setQuery('');
    onOpenChange(next);
  };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={handleOpenChange}
      label="Search Oppulse AI"
      shouldFilter
      className={cn(
        'fixed top-[15vh] left-1/2 z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2',
        'rounded-panel border border-border bg-surface p-0 shadow-popover',
      )}
    >
      <div className="flex items-center gap-2 border-b border-border px-4">
        <Search aria-hidden="true" className="size-4 shrink-0 text-text-muted" />
        <Command.Input
          value={query}
          onValueChange={setQuery}
          placeholder="Search opportunities, missions, documents…"
          className="min-h-12 w-full bg-transparent text-sm text-text outline-none placeholder:text-text-muted/70"
        />
      </div>
      <Command.List className="max-h-80 overflow-y-auto p-2">
        <Command.Empty className="px-3 py-6 text-center text-sm text-text-muted">
          Nothing matched “{query}”.
        </Command.Empty>
        {COMMAND_ITEMS.map((item) => (
          <Command.Item
            key={item.to}
            value={`${item.group} ${item.label}`}
            onSelect={() => {
              void navigate(item.to);
              onOpenChange(false);
            }}
            className="flex min-h-11 cursor-pointer items-center rounded-button px-3 text-sm text-text outline-none data-[selected=true]:bg-surface-subtle"
          >
            {item.label}
          </Command.Item>
        ))}
      </Command.List>
    </Command.Dialog>
  );
}
