import { describe, expect, it, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { AgentPanel } from './AgentPanel';
import { setChaosRule } from '@/mocks/chaos';

/**
 * The home agent panel.
 *
 * It wires the shared pending state of the agent into the composer, so the
 * whole surface — not just the spinner — refuses a second question while
 * the first answer is still on the wire.
 */
describe('AgentPanel', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('locks the composer while the agent is answering', async () => {
    setChaosRule({ pattern: '/assistant', mode: 'slow', delayMs: 600 });
    const { user } = renderWithProviders(<AgentPanel />);

    await user.click(screen.getAllByRole('button', { name: 'Find opportunities for me' })[0]!);

    expect(screen.getByLabelText('Message to Oppulse')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Attach a document or paste a link' }),
    ).toBeDisabled();

    await waitFor(
      () => {
        expect(screen.getByLabelText('Message to Oppulse')).toBeEnabled();
      },
      { timeout: 5000 },
    );
    // The send button is only ever gated by pending — an empty draft is a
    // separate, normal rule.
    expect(screen.getByRole('button', { name: 'Attach a document or paste a link' })).toBeEnabled();
  });
});
