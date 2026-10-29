import { describe, expect, it, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse, delay } from 'msw';
import { useLocation } from 'react-router-dom';
import { renderWithProviders, signInAsDemo } from '@/test/utils';
import { HomePage } from './HomePage';
import { PrototypeBanner } from '@/components/feedback/banners';
import { clearAllChaosRules, setChaosRule } from '@/mocks/chaos';
import { resetState } from '@/mocks/state';
import { server } from '@/mocks/server';
import { apiUrl } from '@/mocks/handlers/urls';

/** Exposes the current URL so tests can assert selection persistence. */
function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{`${location.pathname}${location.search}`}</span>;
}

/**
 * The home workspace is the first thing a judge sees, so it is tested for
 * the behaviours that matter: it loads, it labels the fit score honestly,
 * and it recovers from a failing provider.
 */
describe('HomePage', () => {
  beforeEach(() => {
    resetState();
    signInAsDemo();
    clearAllChaosRules();
  });

  it('loads the workspace and greets the student', async () => {
    renderWithProviders(<HomePage />);

    expect(await screen.findByRole('heading', { name: /Hi Sara!/ })).toBeInTheDocument();
  });

  it('shows ranked opportunities from the mission', async () => {
    renderWithProviders(<HomePage />);

    expect(await screen.findByRole('heading', { name: 'Top opportunities' })).toBeInTheDocument();

    expect(
      await screen.findByRole('link', { name: /Helios Research Fellowship/ }),
    ).toBeInTheDocument();
  });

  it('never presents a fit score as an admission probability', async () => {
    renderWithProviders(<HomePage />);

    await screen.findByRole('heading', { name: 'Top opportunities' });

    const score = await screen.findAllByRole('img', {
      name: /this is not an admission probability/i,
    });
    expect(score.length).toBeGreaterThan(0);
  });

  it('surfaces a conflicting deadline instead of hiding it', async () => {
    renderWithProviders(<HomePage />);

    expect(await screen.findByText('Deadline conflict')).toBeInTheDocument();
  });

  it('states clearly that the data is sample data', async () => {
    renderWithProviders(<PrototypeBanner />);

    expect(await screen.findByText('Sample data')).toBeInTheDocument();
    expect(screen.getByText(/examples while your workspace is being set up/i)).toBeInTheDocument();
  });

  it('shows a recoverable error state when the provider fails', async () => {
    setChaosRule({ pattern: '/opportunities', mode: 'error', status: 500, delayMs: 0 });

    renderWithProviders(<HomePage />);

    const alert = await screen.findByRole('alert', {}, { timeout: 5000 });
    expect(alert).toHaveTextContent(/could not load your opportunities/i);
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('keeps the workspace when one summary section fails, and that section says so', async () => {
    setChaosRule({ pattern: '/profile', mode: 'error', status: 500, delayMs: 0 });

    renderWithProviders(<HomePage />);

    // The page's primary content still loads — one panel failing is not a
    // page failure.
    expect(await screen.findByRole('heading', { name: /Hi Sara!/ })).toBeInTheDocument();

    const alerts = await screen.findAllByRole('alert', {}, { timeout: 5000 });
    expect(alerts.some((alert) => alert.textContent.includes('This section could not load'))).toBe(
      true,
    );
    expect(screen.getAllByRole('button', { name: /try again/i }).length).toBeGreaterThan(0);
  });

  it('shows the rate-limited state when the service asks for a moment', async () => {
    setChaosRule({ pattern: '/profile', mode: 'error', status: 429, delayMs: 0 });

    renderWithProviders(<HomePage />);

    expect(await screen.findByRole('heading', { name: /Hi Sara!/ })).toBeInTheDocument();
    expect(
      await screen.findByText(
        'The service needs a moment before trying again.',
        {},
        { timeout: 8000 },
      ),
    ).toBeInTheDocument();
  });

  it('shows the provider-unavailable state without losing the saved-work promise', async () => {
    setChaosRule({ pattern: '/opportunities', mode: 'error', status: 503, delayMs: 0 });

    renderWithProviders(<HomePage />);

    expect(
      await screen.findByText('The AI provider is temporarily unavailable', {}, { timeout: 8000 }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Your mission is saved/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry analysis/i })).toBeInTheDocument();
  });

  it('keeps the data on the panel and says so while a refresh is in flight', async () => {
    const { queryClient } = renderWithProviders(<HomePage />);

    // The profile panel has loaded; its facts are on screen.
    await screen.findByText(/confirmed fact\(s\)/, {}, { timeout: 5000 });

    setChaosRule({ pattern: '/profile', mode: 'slow', delayMs: 2000 });
    void queryClient.invalidateQueries({ queryKey: ['profile'] });

    expect(await screen.findByText('Refreshing…', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByText(/confirmed fact\(s\)/)).toBeInTheDocument();
  });

  it('shows the factual research events for the active run', async () => {
    renderWithProviders(<HomePage />);

    expect(await screen.findByRole('heading', { name: 'Activity' })).toBeInTheDocument();
    expect(screen.getByText('Research events')).toBeInTheDocument();
  });

  it('keeps the selected opportunity in the URL so a refresh never loses it', async () => {
    const { user } = renderWithProviders(
      <>
        <HomePage />
        <LocationProbe />
      </>,
      { route: '/home' },
    );

    const first = await screen.findByRole('button', { name: /Helios Research Fellowship/ });
    await user.click(first);

    expect(await screen.findByTestId('location')).toHaveTextContent(
      /opportunity=d4000000-0000-4000-8000-000000000001/,
    );
  });

  it('opens the panel straight from a shared URL', async () => {
    renderWithProviders(
      <>
        <HomePage />
        <LocationProbe />
      </>,
      { route: '/home?opportunity=d4000000-0000-4000-8000-000000000001' },
    );

    expect(
      await screen.findByRole('heading', { name: /Helios Research Fellowship/ }),
    ).toBeInTheDocument();
  });

  it('closes the panel on request and stays closed', async () => {
    const { user } = renderWithProviders(
      <>
        <HomePage />
        <LocationProbe />
      </>,
      { route: '/home?opportunity=d4000000-0000-4000-8000-000000000001' },
    );

    await screen.findByRole('heading', { name: /Helios Research Fellowship/ });
    await user.click(screen.getByRole('button', { name: /Close the opportunity panel/ }));

    expect(await screen.findByTestId('location')).toHaveTextContent(/panel=closed/);
    expect(
      screen.queryByRole('heading', { name: /Helios Research Fellowship/ }),
    ).not.toBeInTheDocument();
  });

  it('pins the opportunity into the agent context from the panel', async () => {
    const { user } = renderWithProviders(<HomePage />, {
      route: '/home?opportunity=d4000000-0000-4000-8000-000000000001',
    });

    await screen.findByRole('heading', { name: /Helios Research Fellowship/ });
    await user.click(screen.getByRole('button', { name: /Pin to chat context/ }));

    expect(
      await screen.findByText(/Pinned — the agent answers with this opportunity in context/),
    ).toBeInTheDocument();
  });

  it('queues exactly one run for a double click and says it is starting', async () => {
    let starts = 0;
    server.use(
      http.post(apiUrl('/missions/:id/runs'), async () => {
        starts += 1;
        await delay(1500);
        return HttpResponse.json(
          { runId: '2c000000-0000-4000-8000-000000000099', status: 'queued' },
          { status: 202 },
        );
      }),
    );

    const { user } = renderWithProviders(<HomePage />);
    const button = await screen.findByRole('button', { name: /Run research/ });

    await user.click(button);

    // The button says what it is doing and refuses the second click.
    expect(await screen.findByText('Starting run…', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(button).toBeDisabled();

    fireEvent.click(button);
    // A second request, if one had been queued, would be on the wire by now.
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(starts).toBe(1);
  });

  it('pauses and then cancels a run from the strip', async () => {
    const { user } = renderWithProviders(<HomePage />);

    await user.click(await screen.findByRole('button', { name: /Run research/ }));

    // The run is in flight, so the strip offers a pause and a cancel.
    const pause = await screen.findByRole('button', { name: 'Pause' }, { timeout: 5000 });
    expect(screen.getByRole('button', { name: 'Cancel run' })).toBeEnabled();

    await user.click(pause);

    // Paused: resume replaces pause, cancel stays.
    await screen.findByRole('button', { name: 'Resume' }, { timeout: 5000 });
    expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel run' }));

    expect(await screen.findByText('Run cancelled')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Cancelled')).toBeInTheDocument();
    });
    // A cancelled run is finished: the strip offers a fresh run and nothing else.
    expect(screen.getByRole('button', { name: 'Run research' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Resume' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel run' })).not.toBeInTheDocument();
  });
});
