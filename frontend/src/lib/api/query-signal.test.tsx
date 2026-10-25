import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders, requestPath, signInAsDemo } from '@/test/utils';
import { useProfile } from '@/lib/queries';
import { setChaosRule } from '@/mocks/chaos';

function ProfileProbe() {
  const { isPending } = useProfile();
  return <p data-testid="state">{isPending ? 'loading' : 'ready'}</p>;
}

/**
 * Query cancellation.
 *
 * Every query carries an abort signal, and an unmounted view takes its
 * in-flight request down with it — an answer nobody is waiting for should
 * not be waited for.
 */
describe('query signals', () => {
  it('aborts the in-flight request when the view unmounts', async () => {
    signInAsDemo();
    setChaosRule({ pattern: '/profile', mode: 'slow', delayMs: 5000 });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const { unmount } = renderWithProviders(<ProfileProbe />);
    expect(screen.getByTestId('state')).toHaveTextContent('loading');

    // Wait until the profile request is actually on the wire.
    await waitFor(() => {
      const called = fetchSpy.mock.calls.some(([input]) => requestPath(input).endsWith('/profile'));
      expect(called).toBe(true);
    });

    const profileCall = fetchSpy.mock.calls.find(([input]) =>
      requestPath(input).endsWith('/profile'),
    );
    const signal = profileCall?.[1]?.signal;
    expect(signal).toBeDefined();
    expect(signal?.aborted).toBe(false);

    let aborted = false;
    signal?.addEventListener('abort', () => {
      aborted = true;
    });

    unmount();

    await waitFor(() => expect(aborted).toBe(true));

    fetchSpy.mockRestore();
  });
});
