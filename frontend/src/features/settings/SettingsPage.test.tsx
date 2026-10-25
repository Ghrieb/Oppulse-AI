import { describe, expect, it, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders, signInAsDemo } from '@/test/utils';
import { SettingsPage } from './SettingsPage';
import { resetState } from '@/mocks/state';

/**
 * The settings.
 *
 * The first MVP delivers in-app alerts only. Email is a later increment, so
 * the interface must not offer a control for a channel that cannot deliver
 * — and must not advertise it as live.
 */
describe('SettingsPage', () => {
  beforeEach(() => {
    resetState();
    signInAsDemo();
  });

  it('says that in-app alerts are the only channel for now', async () => {
    renderWithProviders(<SettingsPage />);

    expect(await screen.findByText('In-app only, for now')).toBeInTheDocument();
    expect(screen.getByText(/Email notifications are a later increment/)).toBeInTheDocument();
  });

  it('does not offer an email control that cannot deliver anything', async () => {
    renderWithProviders(<SettingsPage />);

    await screen.findByText('In-app only, for now');

    expect(screen.queryByRole('radio', { name: 'Daily digest' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('switch', { name: 'Send me email notifications' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /verification link/i })).not.toBeInTheDocument();
  });

  it('still offers the consents that do matter', async () => {
    renderWithProviders(<SettingsPage />);

    expect(
      await screen.findByRole('switch', { name: 'Use my confirmed profile' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('switch', { name: 'Use document content for analysis' }),
    ).toBeInTheDocument();
  });

  it('never offers a Telegram or bot channel', async () => {
    renderWithProviders(<SettingsPage />);

    await screen.findByText('In-app only, for now');

    expect(screen.queryByText(/Telegram/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/bot/i)).not.toBeInTheDocument();
  });
});
