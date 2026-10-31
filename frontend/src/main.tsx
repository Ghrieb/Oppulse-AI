import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { router } from './app/router';
import { AgentProvider } from './app/agent-provider';
import { ErrorBoundary } from './app/error-boundary';
import { RouteErrorFallback } from './app/route-fallback';
import { createQueryClient } from './lib/api/query-client';
import { ToastProvider } from './components/feedback/toast';
import { TooltipProvider } from './components/ui/tooltip';
import { USE_FIXTURE_BACKEND } from './lib/api/config';
import './styles/globals.css';

const queryClient = createQueryClient();

/**
 * In mock mode the MSW service worker intercepts real network requests.
 * The app is rendered only after the worker is active, otherwise the first
 * requests would escape to the network and fail.
 */
async function enableMocking(): Promise<void> {
  if (!USE_FIXTURE_BACKEND) return;

  const { worker, exposeDevTools, startGuestWorkspace } = await import('./mocks/browser');
  // The hosted demo deliberately opens as a guest workspace. It uses the
  // same persisted fixture store as the local prototype, but never asks a
  // reviewer to create an account before they can explore the product.
  startGuestWorkspace();
  exposeDevTools();
  await worker.start({
    onUnhandledFrame: 'bypass',
    serviceWorker: { url: '/mockServiceWorker.js' },
  });
}

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container #root was not found in index.html.');
}

const root = createRoot(container);

void enableMocking()
  .catch((error: unknown) => {
    // The mock worker failing to start must be loud in development, and
    // must never take the whole application down in production.
    if (import.meta.env.DEV) {
      console.error('[oppulse] Failed to start the mock service worker.', error);
    }
  })
  .finally(() => {
    root.render(
      <StrictMode>
        <ErrorBoundary fallback={(error) => <RouteErrorFallback error={error} />}>
          <QueryClientProvider client={queryClient}>
            <AgentProvider>
              <TooltipProvider delayDuration={200}>
                <ToastProvider>
                  <RouterProvider router={router} />
                </ToastProvider>
              </TooltipProvider>
            </AgentProvider>
          </QueryClientProvider>
        </ErrorBoundary>
      </StrictMode>,
    );
  });
