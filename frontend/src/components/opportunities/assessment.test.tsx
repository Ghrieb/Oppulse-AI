import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { FitScore, EligibilitySummary } from './assessment';

/**
 * The most consequential accessibility decision in the product: a fit score
 * must never be mistaken for an admission probability (spec §8.1).
 */
describe('FitScore', () => {
  it('spells out that the number is a profile match, not a probability', () => {
    renderWithProviders(<FitScore match={{ fitScore: 92, fitLabel: 'Excellent profile match' }} />);

    const ring = screen.getByRole('img', {
      name: /profile match: 92 out of 100\. this is not an admission probability/i,
    });
    expect(ring).toBeInTheDocument();
  });

  it('shows the score and the label as text as well', () => {
    renderWithProviders(<FitScore match={{ fitScore: 74, fitLabel: 'Good profile match' }} />);

    expect(screen.getByText(/Profile match/)).toBeInTheDocument();
    expect(screen.getByText(/74\/100/)).toBeInTheDocument();
  });
});

describe('EligibilitySummary', () => {
  it.each([
    ['likely', /eligibility: likely/i],
    ['unresolved', /eligibility: unresolved/i],
    ['ineligible', /eligibility: not met/i],
  ] as const)('renders the %s state', (eligibility, matcher) => {
    renderWithProviders(<EligibilitySummary eligibility={eligibility} />);
    expect(screen.getByText(matcher)).toBeInTheDocument();
  });
});
