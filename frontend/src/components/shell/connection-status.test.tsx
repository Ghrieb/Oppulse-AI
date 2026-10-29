import { describe, expect, it, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders, signInAsDemo } from '@/test/utils';
import { resetState } from '@/mocks/state';
import {
  ActiveRunPill,
  CapabilityBanner,
  ConnectionIndicator,
  RunStatusPill,
} from './connection-status';

/**
 * The shell must state its connection honestly: which API, which product
 * mode, and what each capability actually is — never a blanket claim.
 */
describe('ConnectionIndicator', () => {
  beforeEach(() => {
    resetState();
    signInAsDemo();
  });

  it('labels the app as sample data in mock mode', () => {
    renderWithProviders(<ConnectionIndicator />);

    expect(screen.getByRole('button', { name: /Sample data/ })).toBeInTheDocument();
  });

  it('reports plainly what the student is looking at and each capability', async () => {
    const { user } = renderWithProviders(<ConnectionIndicator />);

    await user.click(screen.getByRole('button', { name: /Sample data/ }));

    expect(
      await screen.findByText(/Running on sample data — examples, not real records/),
    ).toBeInTheDocument();
    expect(screen.getByText('AI reasoning')).toBeInTheDocument();
    expect(screen.getAllByText('Simulated').length).toBeGreaterThan(0);
    expect(screen.getByText('Not configured')).toBeInTheDocument();
  });
});

describe('CapabilityBanner', () => {
  beforeEach(() => {
    resetState();
    signInAsDemo();
  });

  it('stays hidden in demo mode — the sample-data banner owns that surface', () => {
    renderWithProviders(<CapabilityBanner />);

    expect(screen.queryByText('Service status')).not.toBeInTheDocument();
  });
});

describe('RunStatusPill', () => {
  it('speaks plainly about a running run', () => {
    renderWithProviders(<RunStatusPill status="running" />);

    expect(screen.getByRole('button', { name: 'Agent is researching' })).toBeInTheDocument();
  });

  it('says when the agent needs input', () => {
    renderWithProviders(<RunStatusPill status="waiting_for_input" />);

    expect(screen.getByRole('button', { name: 'Agent needs your input' })).toBeInTheDocument();
  });
});

describe('ActiveRunPill', () => {
  beforeEach(() => {
    resetState();
    signInAsDemo();
  });

  it('stays hidden when the latest run has reached a terminal state', () => {
    // The demo mission's run is `completed`, so no run pill is shown.
    renderWithProviders(<ActiveRunPill />);

    expect(screen.queryByRole('button', { name: /Agent is researching/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Research queued/ })).not.toBeInTheDocument();
  });
});
