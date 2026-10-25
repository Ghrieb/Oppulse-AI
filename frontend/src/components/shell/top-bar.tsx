import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, LogOut, Menu, Search, Settings, User } from 'lucide-react';
import { Avatar } from '@/components/ui/display';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/controls';
import { cn } from '@/lib/cn';
import { useAlerts, useSession } from '@/lib/queries';
import { ActiveRunPill, ConnectionIndicator } from './connection-status';

/**
 * Top bar: global search, run status, notifications and the profile menu.
 */
export function TopBar({
  onOpenMenu,
  onOpenCommand,
}: {
  onOpenMenu: () => void;
  onOpenCommand: () => void;
}) {
  const navigate = useNavigate();
  const { data: session } = useSession();
  const { data: alerts } = useAlerts();
  const unread = alerts?.unreadCount ?? 0;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onOpenCommand();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onOpenCommand]);

  return (
    <header className="sticky top-0 z-30 flex min-h-16 items-center gap-3 border-b border-border bg-surface/95 px-4 backdrop-blur">
      <button
        type="button"
        onClick={onOpenMenu}
        className="grid size-11 shrink-0 place-items-center rounded-button text-text hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring lg:hidden"
      >
        <Menu aria-hidden="true" className="size-5" />
        <span className="sr-only">Open navigation</span>
      </button>

      <button
        type="button"
        onClick={onOpenCommand}
        className={cn(
          // `min-w-0` lets the field shrink below its content width so the
          // notification and profile controls stay on screen.
          'flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-button border border-border bg-background px-3 text-sm text-text-muted',
          'hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
          'sm:max-w-md',
        )}
      >
        <Search aria-hidden="true" className="size-4 shrink-0" />
        <span className="truncate">Search opportunities, ask a question…</span>
        <kbd className="ml-auto hidden shrink-0 rounded border border-border bg-surface-subtle px-1.5 py-0.5 font-mono text-[11px] text-text-muted sm:inline">
          Ctrl K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1">
        <div className="hidden items-center gap-1 sm:flex">
          <ActiveRunPill />
          <ConnectionIndicator />
        </div>

        <button
          type="button"
          onClick={() => navigate('/monitoring')}
          className="relative grid size-11 shrink-0 place-items-center rounded-button text-text hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        >
          <Bell aria-hidden="true" className="size-5" />
          <span className="sr-only">
            {unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
          </span>
          {unread > 0 ? (
            <span
              aria-hidden="true"
              className="absolute top-1.5 right-1.5 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white"
            >
              {unread}
            </span>
          ) : null}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex min-h-11 items-center gap-2 rounded-button px-1.5 pr-2 hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
            >
              <Avatar
                name={session?.user.fullName ?? 'Guest'}
                src={session?.user.avatarUrl}
                size="sm"
              />
              <span className="hidden text-sm font-medium text-text sm:inline">
                {session?.user.fullName ?? 'Guest'}
              </span>
              <ChevronDown aria-hidden="true" className="hidden size-4 text-text-muted sm:inline" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>{session?.user.email ?? 'Not signed in'}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate('/profile')}>
              <User aria-hidden="true" className="size-4 text-text-muted" />
              Profile and CV
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate('/settings')}>
              <Settings aria-hidden="true" className="size-4 text-text-muted" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/auth/sign-in">
                <LogOut aria-hidden="true" className="size-4 text-text-muted" />
                Sign out
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
