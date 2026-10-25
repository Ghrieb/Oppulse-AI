import { describe, expect, it, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders, requestPath } from '@/test/utils';
import { useAgent } from '@/lib/agent-context';
import { setChaosRule } from '@/mocks/chaos';

/**
 * The agent provider.
 *
 * It owns the working context and the conversation for every surface, so
 * the home panel and the assistant route are the same thread.
 */

const OPPORTUNITY_ID = 'd4000000-0000-4000-8000-000000000001';

function Harness() {
  const { context, messages, pending, error, setContext, send } = useAgent();

  return (
    <div>
      <p data-testid="context">{context.opportunityId ?? 'none'}</p>
      <p data-testid="count">{messages.length}</p>
      <p data-testid="pending">{pending ? 'yes' : 'no'}</p>
      <p data-testid="error">{error ?? 'none'}</p>
      <button type="button" onClick={() => setContext({ opportunityId: OPPORTUNITY_ID })}>
        Set context
      </button>
      <button type="button" onClick={() => void send('Am I eligible?')}>
        Ask
      </button>
      <button type="button" onClick={() => void send('Second question')}>
        Ask again
      </button>
      <button type="button" onClick={() => void send('https://helios-fellowship.org/call')}>
        Paste link
      </button>
      <p data-testid="last-blocks">
        {messages
          .at(-1)
          ?.blocks?.map((block) => block.kind)
          .join(',') ?? 'none'}
      </p>
    </div>
  );
}

describe('AgentProvider', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('keeps the working context so a refresh does not lose it', async () => {
    const { user } = renderWithProviders(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Set context' }));

    await waitFor(() => {
      expect(screen.getByTestId('context')).toHaveTextContent(OPPORTUNITY_ID);
    });

    await waitFor(() => {
      const stored = window.localStorage.getItem('oppulse:agent-context');
      expect(stored).toContain(OPPORTUNITY_ID);
    });
  });

  it('appends both sides of the turn to the conversation', async () => {
    const { user } = renderWithProviders(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Ask' }));

    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('2');
    });
  });

  it('stores the conversation so it survives a reload', async () => {
    const { user } = renderWithProviders(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Ask' }));

    await waitFor(() => {
      const stored = window.localStorage.getItem('oppulse:agent:conversation');
      expect(stored).not.toBeNull();
      expect(JSON.parse(stored as string)).toHaveLength(2);
    });
  });

  it('aborts the superseded request when a newer question takes over', async () => {
    setChaosRule({ pattern: '/assistant', mode: 'slow', delayMs: 600 });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const { user } = renderWithProviders(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Ask' }));
    await user.click(screen.getByRole('button', { name: 'Ask again' }));

    // The first request was on the wire when the second one superseded it.
    const messageCalls = () =>
      fetchSpy.mock.calls.filter(([input]) => requestPath(input).endsWith('/assistant/messages'));
    await waitFor(() => expect(messageCalls().length).toBe(2));
    const firstSignal = messageCalls()[0]![1]?.signal;
    expect(firstSignal).toBeDefined();
    await waitFor(() => expect(firstSignal?.aborted).toBe(true));

    // Only the newer answer lands, with no error surfaced for the cancelled one.
    await waitFor(
      () => {
        expect(screen.getByTestId('count')).toHaveTextContent('3');
      },
      { timeout: 5000 },
    );
    expect(screen.getByTestId('error')).toHaveTextContent('none');
    await waitFor(
      () => {
        expect(screen.getByTestId('pending')).toHaveTextContent('no');
      },
      { timeout: 5000 },
    );

    fetchSpy.mockRestore();
  });

  it('starts a run when a bare link is pasted, instead of a chat turn', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { user } = renderWithProviders(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Paste link' }));

    // The analyse endpoint answered, not the messages endpoint.
    await waitFor(() => {
      const analyzeCalls = fetchSpy.mock.calls.filter(([input]) =>
        requestPath(input).endsWith('/opportunities/analyze'),
      );
      expect(analyzeCalls.length).toBe(1);
      const messageCalls = fetchSpy.mock.calls.filter(([input]) =>
        requestPath(input).endsWith('/assistant/messages'),
      );
      expect(messageCalls.length).toBe(0);
    });

    // The reply is a run block, so the run is visible in the thread.
    await waitFor(() => {
      expect(screen.getByTestId('last-blocks')).toHaveTextContent('run');
    });
    await waitFor(() => {
      expect(screen.getByTestId('pending')).toHaveTextContent('no');
    });

    fetchSpy.mockRestore();
  });
});
