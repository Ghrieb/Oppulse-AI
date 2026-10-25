import { QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement, ReactNode } from 'react';
import { ToastProvider } from '@/components/feedback/toast';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AgentProvider } from '@/app/agent-provider';
import { createQueryClient } from '@/lib/api/query-client';
import { signInAsDemo } from '@/mocks/state';

/**
 * Test rendering helper.
 *
 * Every component test runs against the real providers and the real MSW
 * handlers, so the tests exercise the same code path the browser does.
 */
export function renderWithProviders(
  ui: ReactElement,
  options: RenderOptions & { route?: string } = {},
) {
  const { route = '/', ...rest } = options;
  const queryClient = createQueryClient();

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>
          <TooltipProvider>
            <ToastProvider>
              <AgentProvider>{children}</AgentProvider>
            </ToastProvider>
          </TooltipProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );
  }

  return {
    user: userEvent.setup(),
    queryClient,
    ...render(ui, { wrapper: Wrapper, ...rest }),
  };
}

/** Signs the mock session in as the demo student. */
export { signInAsDemo };

/** Re-exported so tests do not need a second import path. */
export { userEvent };

/**
 * The path of a request recorded by a `fetch` spy, whatever form the caller
 * handed it in (string, `URL` or `Request`).
 */
export function requestPath(input: RequestInfo | URL): string {
  if (input instanceof URL) return input.pathname;
  if (typeof input === 'string') return new URL(input, window.location.origin).pathname;
  return new URL(input.url).pathname;
}
