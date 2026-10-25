import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './sidebar';
import { TopBar } from './top-bar';
import { MobileAskButton, MobileNavDrawer } from './mobile-nav';
import { CommandPalette } from './command-palette';
import { CapabilityBanner } from './connection-status';
import { OfflineBanner, PrototypeBanner } from '@/components/feedback/banners';
import { PRODUCT_MODE } from '@/lib/api/config';
import { useAlerts } from '@/lib/queries';

/**
 * Application shell.
 *
 * Desktop: a fixed dark-navy rail beside a light, evidence-first canvas.
 * Tablet and mobile: the rail collapses into a labelled drawer.
 */
export function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const { data: alerts } = useAlerts();
  const unreadAlerts = alerts?.unreadCount ?? 0;

  return (
    <div className="min-h-dvh bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-button focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to main content
      </a>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block">
        <Sidebar unreadAlerts={unreadAlerts} />
      </aside>

      <div className="lg:pl-64">
        <TopBar onOpenMenu={() => setDrawerOpen(true)} onOpenCommand={() => setCommandOpen(true)} />
        <OfflineBanner />
        {PRODUCT_MODE === 'student_testing' ? <CapabilityBanner /> : <PrototypeBanner />}

        <main id="main-content" className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6">
          <Outlet />
        </main>
      </div>

      <MobileNavDrawer open={drawerOpen} onOpenChange={setDrawerOpen} unreadAlerts={unreadAlerts} />
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
      <MobileAskButton />
    </div>
  );
}
