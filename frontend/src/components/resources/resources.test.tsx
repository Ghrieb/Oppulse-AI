import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { CountryIdentityBadge } from './country-identity';
import { InstitutionLogo } from './institution-logo';
import type { InstitutionBrand } from '@/lib/schemas';

/**
 * The identity components must never show a broken image, and the country
 * name must always be available as text.
 */
describe('CountryIdentityBadge', () => {
  it('shows the country name as text, not only as a flag', () => {
    renderWithProviders(
      <CountryIdentityBadge
        country={{ iso2: 'NL', name: 'Netherlands', kind: 'country', region: 'Europe' }}
      />,
    );

    expect(screen.getByText('Netherlands')).toBeInTheDocument();
  });

  it('falls back to a code chip for a country with no drawn flag', () => {
    renderWithProviders(
      <CountryIdentityBadge
        country={{ iso2: 'ZZ', name: 'Somewhere', kind: 'country', region: null }}
      />,
    );

    expect(screen.getByText('Somewhere')).toBeInTheDocument();
    expect(screen.getByText('ZZ')).toBeInTheDocument();
  });

  it('marks a region without pretending it has a flag', () => {
    renderWithProviders(
      <CountryIdentityBadge
        country={{ iso2: 'XU', name: 'Europe and Africa', kind: 'region', region: 'Multiple' }}
      />,
    );

    expect(screen.getByText('Europe and Africa')).toBeInTheDocument();
    expect(screen.getByText('XU')).toBeInTheDocument();
  });
});

describe('InstitutionLogo', () => {
  const brand: InstitutionBrand = {
    institutionName: 'Helios Institute for Applied Genomics',
    officialDomain: 'helios-fellowship.org',
    logoUrl: null,
    bannerUrl: null,
    attribution: null,
    verifiedAt: '2026-10-18T21:10:00.000Z',
    source: 'fallback',
    generated: true,
    iconSource: 'none',
  };

  it('renders the generated mark when no asset is available', () => {
    renderWithProviders(<InstitutionLogo brand={brand} />);

    expect(
      screen.getByRole('img', { name: 'Helios Institute for Applied Genomics mark' }),
    ).toBeInTheDocument();
  });

  it('does not call a third-party service for a synthetic institution', () => {
    const { container } = renderWithProviders(<InstitutionLogo brand={brand} />);

    expect(container.querySelector('img')).toBeNull();
  });

  it('shows the real logo on a detail page when the backend provides one', () => {
    const { container } = renderWithProviders(
      <InstitutionLogo
        brand={{ ...brand, logoUrl: 'https://example.org/logo.svg', source: 'official' }}
        source="asset"
      />,
    );

    const image = container.querySelector('img');
    expect(image).not.toBeNull();
    expect(image?.getAttribute('src')).toBe('https://example.org/logo.svg');
    // Decorative: the institution name is always real text beside it.
    expect(image?.getAttribute('alt')).toBe('');
  });

  it('keeps list views free of image requests', () => {
    const { container } = renderWithProviders(
      <InstitutionLogo
        brand={{ ...brand, logoUrl: 'https://example.org/logo.svg', source: 'official' }}
      />,
    );

    // The default is the generated mark, so a list of twenty results
    // costs nothing.
    expect(container.querySelector('img')).toBeNull();
    expect(
      screen.getByRole('img', { name: 'Helios Institute for Applied Genomics mark' }),
    ).toBeInTheDocument();
  });
});
