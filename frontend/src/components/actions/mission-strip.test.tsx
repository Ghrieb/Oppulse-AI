import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { MissionStrip } from './mission-strip';
import { DEMO_MISSIONS, DEMO_RUNS } from '@/mocks/fixtures/missions';
import { DEMO_MONITOR_TARGETS } from '@/mocks/fixtures/monitoring';
import type { AgentRun } from '@/lib/schemas';

function runWith(status: AgentRun['status']): AgentRun {
  return { ...DEMO_RUNS[0]!, id: '2c000000-0000-4000-8000-000000000042', status };
}

/**
 * Run controls on the strip.
 *
 * A student must always be able to stop a run: pause and cancel while it is
 * working, resume and cancel while it is paused — and the controls say which
 * control is waiting when they are.
 */
describe('MissionStrip run controls', () => {
  it('offers pause and cancel while a run is working', () => {
    renderWithProviders(
      <MissionStrip
        mission={DEMO_MISSIONS[0]}
        run={runWith('running')}
        monitorTarget={DEMO_MONITOR_TARGETS[0]}
        onPauseRun={() => {}}
        onCancelRun={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: 'Pause' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Cancel run' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Resume' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Run research' })).not.toBeInTheDocument();
  });

  it('offers resume and cancel while a run is paused', () => {
    renderWithProviders(
      <MissionStrip
        mission={DEMO_MISSIONS[0]}
        run={runWith('paused')}
        monitorTarget={DEMO_MONITOR_TARGETS[0]}
        onResumeRun={() => {}}
        onCancelRun={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: 'Resume' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Cancel run' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument();
  });

  it('offers no controls once the run is finished', () => {
    renderWithProviders(
      <MissionStrip
        mission={DEMO_MISSIONS[0]}
        run={runWith('completed')}
        monitorTarget={DEMO_MONITOR_TARGETS[0]}
        onRun={() => {}}
        onPauseRun={() => {}}
        onResumeRun={() => {}}
        onCancelRun={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: 'Run research' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Resume' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel run' })).not.toBeInTheDocument();
  });

  it('says which control is waiting and refuses a second press', () => {
    renderWithProviders(
      <MissionStrip
        mission={DEMO_MISSIONS[0]}
        run={runWith('running')}
        monitorTarget={DEMO_MONITOR_TARGETS[0]}
        onPauseRun={() => {}}
        onCancelRun={() => {}}
        runControlPending="pause"
      />,
    );

    expect(screen.getByRole('button', { name: 'Pausing…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel run' })).toBeEnabled();
  });
});
