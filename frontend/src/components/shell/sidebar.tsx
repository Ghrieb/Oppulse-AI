import { NavLink } from 'react-router-dom';
import { SidebarNav } from './sidebar-nav';
import { OppulseMascot } from '@/components/agent/oppulse-mascot';

/**
 * Desktop navigation shell.
 *
 * A fixed dark-navy rail, 256px wide, with the active route also shown in
 * the page title and breadcrumb — the sidebar is never the only way to
 * understand where you are (spec §3.2).
 */
export function Sidebar({ unreadAlerts = 0 }: { unreadAlerts?: number }) {
  return (
    <div className="flex h-full flex-col bg-sidebar px-3 py-4">
      <div className="mb-6 flex items-center gap-3 px-2">
        <img
          src="/brand/oppulse-mark-white.svg"
          alt=""
          aria-hidden="true"
          className="size-9 shrink-0"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">Oppulse AI</p>
          <p className="truncate text-meta text-white/60">Your academic opportunity agent</p>
        </div>
      </div>

      <SidebarNav unreadAlerts={unreadAlerts} className="flex-1" />

      <div className="mt-6 rounded-card border border-white/10 bg-sidebar-raised/60 p-4">
        <div className="flex items-start gap-3">
          <OppulseMascot size="promo" className="-mt-1 -ml-1" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">Your goals, made actionable.</p>
            <p className="mt-1 text-meta text-white/70">
              Oppulse finds, checks and turns opportunities into applications.
            </p>
          </div>
        </div>
        <NavLink
          to="/goals"
          className={({ isActive }) =>
            [
              'mt-3 inline-flex items-center gap-1 text-meta font-medium text-white/90',
              'underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2',
              'focus-visible:outline-focus-ring',
              isActive ? 'opacity-100' : '',
            ].join(' ')
          }
        >
          Learn more
          <span aria-hidden="true">→</span>
        </NavLink>
      </div>
    </div>
  );
}

export function SidebarFallbackLink() {
  return (
    <NavLink to="/home" className="text-sm text-white underline-offset-2 hover:underline">
      Back to workspace
    </NavLink>
  );
}
