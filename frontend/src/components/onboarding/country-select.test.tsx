import { describe, expect, it } from 'vitest';
import { useState } from 'react';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { CountrySelect } from './country-select';
import { countryName, GLOBAL_DESTINATION, regionsFor, searchCountries } from '@/lib/countries';

/**
 * The country step.
 *
 * Students choose countries, and the choice becomes a criterion. Two rules
 * matter most: the country is always a *name* as well as a flag, and the
 * code — never a rendered image — is what the mission stores.
 */
describe('CountrySelect', () => {
  it('shows the country name as text, not only as a flag', () => {
    renderWithProviders(<CountrySelect value={[]} onChange={() => {}} />);

    expect(screen.getByRole('checkbox', { name: /Netherlands/ })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Canada/ })).toBeInTheDocument();
  });

  it('offers a global path, and says it is not a country', () => {
    renderWithProviders(<CountrySelect value={[]} onChange={() => {}} />);

    expect(screen.getByRole('checkbox', { name: /Global — no preference/ })).toBeInTheDocument();
    expect(screen.getByText(/This is not a country\./)).toBeInTheDocument();
  });

  it('selects several countries', async () => {
    function Harness() {
      const [value, setValue] = useState<string[]>([]);
      return <CountrySelect value={value} onChange={setValue} />;
    }

    const { user } = renderWithProviders(<Harness />);

    await user.click(screen.getByRole('checkbox', { name: /Netherlands/ }));
    await user.click(screen.getByRole('checkbox', { name: /Canada/ }));

    expect(screen.getByRole('checkbox', { name: /Netherlands/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Canada/ })).toBeChecked();
  });

  it('searches by name and by code', () => {
    expect(searchCountries('nether').map((country) => country.iso2)).toContain('NL');
    expect(searchCountries('DE').map((country) => country.iso2)).toContain('DE');
    expect(searchCountries('zzzz')).toEqual([]);
  });

  it('falls back to the code for a country it cannot draw', () => {
    expect(countryName('NL')).toBe('Netherlands');
    expect(countryName('ZZ')).toBe('ZZ');
  });

  it('turns a set of countries into the regions the agent searches', () => {
    expect(regionsFor(['NL', 'DE'])).toEqual(['Europe']);
    expect(regionsFor(['NL', 'CA'])).toEqual(['Europe', 'North America']);
    expect(regionsFor([])).toEqual([GLOBAL_DESTINATION]);
    expect(regionsFor([GLOBAL_DESTINATION])).toEqual([GLOBAL_DESTINATION]);
  });
});
