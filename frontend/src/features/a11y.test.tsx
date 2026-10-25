import { describe, expect, it, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders, signInAsDemo } from '@/test/utils';
import { HomePage } from '@/features/home/HomePage';
import { OpportunitiesPage } from '@/features/opportunities/OpportunitiesPage';
import { MonitoringPage } from '@/features/monitoring/MonitoringPage';
import { ProfilePassportPage } from '@/features/profile/ProfilePassportPage';
import { describeViolations, findAccessibilityViolations } from '@/test/a11y';
import { clearAllChaosRules } from '@/mocks/chaos';
import { resetState } from '@/mocks/state';

/**
 * Accessibility is a product requirement, not a final polish pass
 * (spec §8). These tests fail the build on a serious or critical
 * violation.
 */
describe('accessibility', () => {
  beforeEach(() => {
    resetState();
    signInAsDemo();
    clearAllChaosRules();
  });

  it('the home workspace has no serious accessibility violations', async () => {
    const { container } = renderWithProviders(<HomePage />);

    await screen.findByRole('heading', { name: 'Top opportunities' });

    const violations = await findAccessibilityViolations(container);
    expect(describeViolations(violations)).toBe('');
  });

  it('the opportunities list has no serious accessibility violations', async () => {
    const { container } = renderWithProviders(<OpportunitiesPage />);

    await screen.findByRole('heading', { name: 'Opportunities' });

    const violations = await findAccessibilityViolations(container);
    expect(describeViolations(violations)).toBe('');
  });

  it('the monitoring screen has no serious accessibility violations', async () => {
    const { container } = renderWithProviders(<MonitoringPage />);

    await screen.findByRole('heading', { name: 'Monitoring and alerts' });

    const violations = await findAccessibilityViolations(container);
    expect(describeViolations(violations)).toBe('');
  });

  it('the profile passport has no serious accessibility violations', async () => {
    const { container } = renderWithProviders(<ProfilePassportPage />);

    await screen.findByRole('heading', { name: 'Profile passport' });

    const violations = await findAccessibilityViolations(container);
    expect(describeViolations(violations)).toBe('');
  });
});
