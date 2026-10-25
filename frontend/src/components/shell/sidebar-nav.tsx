import { NavLink } from 'react-router-dom';
import { NAV_ITEMS, type NavItem } from './nav';
import { cn } from '@/lib/cn';

export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn('grid size-9 shrink-0 place-items-center', className)}>
      <img src="/brand/oppulse-mark.svg" alt="" aria-hidden="true" className="size-full" />
    </span>
  );
}

export function SidebarNav({
  onNavigate,
  unreadAlerts = 0,
  className,
}: {
  onNavigate?: (() => void) | undefined;
  unreadAlerts?: number | undefined;
  className?: string | undefined;
}) {
  return (
    <nav aria-label="Primary" className={cn('flex flex-col gap-1', className)}>
      {NAV_ITEMS.map((item) => (
        <SidebarLink
          key={item.to}
          item={item}
          unreadAlerts={unreadAlerts}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  );
}

function SidebarLink({
  item,
  unreadAlerts,
  onNavigate,
}: {
  item: NavItem;
  unreadAlerts: number;
  onNavigate?: (() => void) | undefined;
}) {
  const Icon = item.icon;
  const showBadge = item.badge === 'alerts' && unreadAlerts > 0;

  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'flex min-h-11 items-center gap-3 rounded-button px-3 text-sm font-medium transition-colors',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
          isActive
            ? 'bg-sidebar-raised text-white'
            : 'text-white/70 hover:bg-white/10 hover:text-white',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon aria-hidden="true" className="size-[18px] shrink-0" />
          <span className="flex-1 truncate">{item.label}</span>
          {showBadge ? (
            <span
              className="grid min-w-5 place-items-center rounded-full bg-danger px-1.5 py-0.5 text-[11px] font-semibold text-white"
              aria-label={`${unreadAlerts} unread alerts`}
            >
              {unreadAlerts}
            </span>
          ) : null}
          {isActive ? <span className="sr-only">(current page)</span> : null}
        </>
      )}
    </NavLink>
  );
}
