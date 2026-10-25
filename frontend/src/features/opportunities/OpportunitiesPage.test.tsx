import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders, requestPath } from '@/test/utils';
import { OpportunitiesPage } from './OpportunitiesPage';
import { setChaosRule } from '@/mocks/chaos';

const FIRST_TITLE = 'Helios Research Fellowship in Computational Biology';

/**
 * The dismiss action.
 *
 * Dismissing is an exclusion: the card may only leave after the server
 * confirms it, a failure must say so, and a failed dismissal must not be
 * blindly retried.
 */
describe('OpportunitiesPage', () => {
  it('reports a failed dismissal once, without a retry or a premature removal', async () => {
    const { user } = renderWithProviders(<OpportunitiesPage />);

    // Let the page load, then fail only the dismissal.
    expect(
      await screen.findByRole('link', { name: FIRST_TITLE }, { timeout: 5000 }),
    ).toBeInTheDocument();
    setChaosRule({ pattern: '/opportunities', mode: 'error', status: 503, delayMs: 0 });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await user.click(screen.getAllByRole('button', { name: 'More actions' })[0]!);
    await user.click(screen.getByRole('menuitem', { name: 'Not for me' }));

    expect(
      await screen.findByText('We could not remove that from your results', {}, { timeout: 5000 }),
    ).toBeInTheDocument();

    // Give any (incorrect) retry a moment to land, then count the attempts.
    await new Promise((resolve) => setTimeout(resolve, 400));
    const dismissCalls = fetchSpy.mock.calls.filter(([input]) =>
      requestPath(input).endsWith('/dismiss'),
    );
    expect(dismissCalls).toHaveLength(1);

    // The card was never optimistically removed: it is still on screen.
    expect(screen.getByRole('link', { name: FIRST_TITLE })).toBeInTheDocument();

    fetchSpy.mockRestore();
  });
});
