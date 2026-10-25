import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MessageSquareText, X } from 'lucide-react';
import { SidebarNav } from './sidebar-nav';
import { cn } from '@/lib/cn';

/**
 * Mobile navigation drawer.
 *
 * The sidebar collapses into a labelled drawer on small screens, with the
 * current route still shown in the page title and breadcrumb.
 */
export function MobileNavDrawer({
  open,
  onOpenChange,
  unreadAlerts = 0,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unreadAlerts?: number;
}) {
  const location = useLocation();

  useEffect(() => {
    onOpenChange(false);
    // Close the drawer whenever the route changes.
  }, [location.pathname, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onOpenChange]);

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 lg:hidden',
        open ? 'pointer-events-auto' : 'pointer-events-none',
      )}
      aria-hidden={!open}
    >
      <button
        type="button"
        tabIndex={open ? 0 : -1}
        aria-label="Close navigation"
        onClick={() => onOpenChange(false)}
        className={cn(
          'absolute inset-0 bg-sidebar/50 transition-opacity',
          open ? 'opacity-100' : 'opacity-0',
        )}
      />
      <div
        role="dialog"
        aria-modal={open}
        aria-label="Navigation"
        className={cn(
          'absolute inset-y-0 left-0 flex w-[min(20rem,85vw)] flex-col bg-sidebar px-3 py-4 transition-transform duration-200',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="mb-4 flex items-center justify-between px-2">
          <p className="text-sm font-semibold text-white">Oppulse AI</p>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="grid size-11 place-items-center rounded-button text-white/80 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            <X aria-hidden="true" className="size-5" />
            <span className="sr-only">Close navigation</span>
          </button>
        </div>

        <SidebarNav unreadAlerts={unreadAlerts} onNavigate={() => onOpenChange(false)} />
      </div>
    </div>
  );
}

/**
 * Persistent bottom action for the agent composer on mobile.
 * The spec keeps "Ask Oppulse" reachable from every screen.
 */
export function MobileAskButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 240);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <Link
      to="/assistant"
      className={cn(
        'fixed right-4 bottom-4 z-40 flex min-h-12 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-white shadow-popover',
        'transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
        visible ? 'opacity-100' : 'pointer-events-none opacity-0 lg:hidden',
      )}
    >
      <MessageSquareText aria-hidden="true" className="size-4" />
      Ask Oppulse
    </Link>
  );
}
