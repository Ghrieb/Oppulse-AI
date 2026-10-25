import { describe, expect, it, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderWithProviders, signInAsDemo } from '@/test/utils';
import { ProfilePassportPage } from './ProfilePassportPage';
import { getState, resetState } from '@/mocks/state';

/**
 * The profile passport.
 *
 * The behaviour that matters: a fact must show where it came from, what it
 * is used for, and what it is holding up — and confirming it must actually
 * change the agent's conclusions.
 */
describe('ProfilePassportPage', () => {
  beforeEach(() => {
    resetState();
    signInAsDemo();
  });

  it('shows how much of the profile the agent can use', async () => {
    renderWithProviders(<ProfilePassportPage />);

    const ring = await screen.findByRole('img', { name: /Profile completeness/i });
    expect(ring).toHaveAccessibleName(/of 6 required facts confirmed/i);
  });

  it('lists the sections of the passport', async () => {
    renderWithProviders(<ProfilePassportPage />);

    const nav = await screen.findByRole('navigation', { name: 'Profile sections' });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'About me' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Education' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review history' })).toBeInTheDocument();
  });

  it('shows the provenance and the purpose of a fact', async () => {
    const { user } = renderWithProviders(<ProfilePassportPage />);

    const fact = await screen.findByRole('button', { name: /Nationality/ });
    await user.click(fact);

    expect(await screen.findByText('From Benali_CV.pdf')).toBeInTheDocument();
    expect(screen.getByText(/Checks the nationality and residency clauses/)).toBeInTheDocument();
  });

  it('says what a pending fact is holding up', async () => {
    const { user } = renderWithProviders(<ProfilePassportPage />);

    await user.click(await screen.findByRole('button', { name: /Languages and certificates/ }));
    const fact = await screen.findByRole('button', { name: /English \(CEFR\)/ });
    await user.click(fact);

    expect(await screen.findByText(/Holding up \d+ requirement/)).toBeInTheDocument();
    expect(screen.getAllByText(/English proficiency/).length).toBeGreaterThan(0);
  });

  it('confirms a fact and resolves the requirement that depended on it', async () => {
    const { user } = renderWithProviders(<ProfilePassportPage />);

    await user.click(await screen.findByRole('button', { name: /Languages and certificates/ }));
    const fact = await screen.findByRole('button', { name: /English \(CEFR\)/ });
    await user.click(fact);

    await user.click(await screen.findByRole('button', { name: 'Confirm' }));

    await waitFor(() => {
      const confirmed = getState().profile.facts.find((item) => item.key === 'english_level');
      expect(confirmed?.status).toBe('confirmed');
    });

    // The requirement that was blocked is now satisfied.
    await waitFor(() => {
      const opportunity = getState().opportunities.find(
        (item) => item.id === 'd4000000-0000-4000-8000-000000000001',
      );
      const requirement = opportunity?.requirements.find(
        (item) => item.profileFactKey === 'english_level',
      );
      expect(requirement?.status).toBe('likely');
    });

    // And the assessment follows.
    await waitFor(() => {
      const match = getState().matches.find(
        (item) => item.opportunityId === 'd4000000-0000-4000-8000-000000000001',
      );
      expect(match?.eligibility).toBe('likely');
      expect(match?.warnings).toHaveLength(0);
    });
  });

  it('records every change in the review history', async () => {
    const { user } = renderWithProviders(<ProfilePassportPage />);

    await user.click(await screen.findByRole('button', { name: /Languages and certificates/ }));
    await user.click(await screen.findByRole('button', { name: /English \(CEFR\)/ }));
    await user.click(await screen.findByRole('button', { name: 'Confirm' }));

    await waitFor(() => {
      expect(getState().revisions.length).toBeGreaterThan(0);
      expect(getState().revisions[0]?.action).toBe('confirmed');
    });

    await user.click(await screen.findByRole('button', { name: 'Review history' }));
    const history = await screen.findByRole('list', { name: 'Review history' });
    expect(within(history).getByText('English (CEFR)')).toBeInTheDocument();
  });

  it('excludes a fact from AI use and the requirement returns to unresolved', async () => {
    const { user } = renderWithProviders(<ProfilePassportPage />);

    await user.click(await screen.findByRole('button', { name: /Languages and certificates/ }));
    await user.click(await screen.findByRole('button', { name: /English \(CEFR\)/ }));

    await user.click(await screen.findByRole('button', { name: /Exclude from AI use/i }));

    await waitFor(() => {
      const fact = getState().profile.facts.find((item) => item.key === 'english_level');
      expect(fact?.excluded).toBe(true);
    });

    await waitFor(() => {
      const opportunity = getState().opportunities.find(
        (item) => item.id === 'd4000000-0000-4000-8000-000000000001',
      );
      const requirement = opportunity?.requirements.find(
        (item) => item.profileFactKey === 'english_level',
      );
      expect(requirement?.status).toBe('unresolved');
      expect(requirement?.explanation).toMatch(/excluded/i);
    });
  });
});
