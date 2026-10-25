/**
 * The country catalogue.
 *
 * Students think in countries, not in regions, and the brief is explicit
 * that the country is a *criterion* — so the codes are what the mission
 * stores. The flag is a visual aid and never the data: a country the
 * interface cannot draw falls back to its ISO code and its name.
 *
 * The list is deliberately modest — the countries students actually apply
 * to — and the picker searches it, so the list can grow without becoming a
 * wall.
 */
export interface Country {
  /** ISO-3166 alpha-2. */
  iso2: string;
  name: string;
  /** The broad grouping, used for the coarse mission scope. */
  region: string;
}

export const COUNTRIES: readonly Country[] = [
  { iso2: 'NL', name: 'Netherlands', region: 'Europe' },
  { iso2: 'BE', name: 'Belgium', region: 'Europe' },
  { iso2: 'FR', name: 'France', region: 'Europe' },
  { iso2: 'DE', name: 'Germany', region: 'Europe' },
  { iso2: 'ES', name: 'Spain', region: 'Europe' },
  { iso2: 'IT', name: 'Italy', region: 'Europe' },
  { iso2: 'PT', name: 'Portugal', region: 'Europe' },
  { iso2: 'IE', name: 'Ireland', region: 'Europe' },
  { iso2: 'GB', name: 'United Kingdom', region: 'Europe' },
  { iso2: 'CH', name: 'Switzerland', region: 'Europe' },
  { iso2: 'AT', name: 'Austria', region: 'Europe' },
  { iso2: 'DK', name: 'Denmark', region: 'Europe' },
  { iso2: 'SE', name: 'Sweden', region: 'Europe' },
  { iso2: 'NO', name: 'Norway', region: 'Europe' },
  { iso2: 'FI', name: 'Finland', region: 'Europe' },
  { iso2: 'PL', name: 'Poland', region: 'Europe' },
  { iso2: 'CZ', name: 'Czechia', region: 'Europe' },
  { iso2: 'HU', name: 'Hungary', region: 'Europe' },
  { iso2: 'GR', name: 'Greece', region: 'Europe' },
  { iso2: 'CA', name: 'Canada', region: 'North America' },
  { iso2: 'US', name: 'United States', region: 'North America' },
  { iso2: 'MX', name: 'Mexico', region: 'North America' },
  { iso2: 'BR', name: 'Brazil', region: 'Latin America' },
  { iso2: 'AR', name: 'Argentina', region: 'Latin America' },
  { iso2: 'CL', name: 'Chile', region: 'Latin America' },
  { iso2: 'JP', name: 'Japan', region: 'Asia' },
  { iso2: 'KR', name: 'South Korea', region: 'Asia' },
  { iso2: 'CN', name: 'China', region: 'Asia' },
  { iso2: 'IN', name: 'India', region: 'Asia' },
  { iso2: 'SG', name: 'Singapore', region: 'Asia' },
  { iso2: 'ID', name: 'Indonesia', region: 'Asia' },
  { iso2: 'IL', name: 'Israel', region: 'Middle East' },
  { iso2: 'AE', name: 'United Arab Emirates', region: 'Middle East' },
  { iso2: 'SA', name: 'Saudi Arabia', region: 'Middle East' },
  { iso2: 'QA', name: 'Qatar', region: 'Middle East' },
  { iso2: 'TR', name: 'Türkiye', region: 'Middle East' },
  { iso2: 'MA', name: 'Morocco', region: 'North Africa' },
  { iso2: 'DZ', name: 'Algeria', region: 'North Africa' },
  { iso2: 'TN', name: 'Tunisia', region: 'North Africa' },
  { iso2: 'EG', name: 'Egypt', region: 'North Africa' },
  { iso2: 'JO', name: 'Jordan', region: 'Middle East' },
  { iso2: 'ZA', name: 'South Africa', region: 'Africa' },
  { iso2: 'KE', name: 'Kenya', region: 'Africa' },
  { iso2: 'NG', name: 'Nigeria', region: 'Africa' },
  { iso2: 'GH', name: 'Ghana', region: 'Africa' },
  { iso2: 'RW', name: 'Rwanda', region: 'Africa' },
  { iso2: 'ET', name: 'Ethiopia', region: 'Africa' },
  { iso2: 'AU', name: 'Australia', region: 'Oceania' },
  { iso2: 'NZ', name: 'New Zealand', region: 'Oceania' },
];

/** The value that means "no destination preference". */
export const GLOBAL_DESTINATION = 'Global';

const BY_CODE = new Map(COUNTRIES.map((country) => [country.iso2, country]));

/** A country by its ISO code, or null when it is not in the catalogue. */
export function countryByCode(iso2: string): Country | null {
  return BY_CODE.get(iso2.toUpperCase()) ?? null;
}

/** The name of a country, or its code when the catalogue does not have it. */
export function countryName(iso2: string): string {
  return countryByCode(iso2)?.name ?? iso2;
}

/** The countries matching a search term, by name or by code. */
export function searchCountries(term: string): Country[] {
  const query = term.trim().toLowerCase();
  if (!query) return [...COUNTRIES];

  return COUNTRIES.filter(
    (country) =>
      country.name.toLowerCase().includes(query) || country.iso2.toLowerCase().startsWith(query),
  );
}

/**
 * The broad regions a set of countries falls into.
 *
 * The mission keeps both: the regions are the coarse scope the agent
 * searches, and the country codes are the criterion it filters and ranks
 * by.
 */
export function regionsFor(countries: string[]): string[] {
  if (countries.length === 0) return [GLOBAL_DESTINATION];

  const regions = new Set<string>();
  for (const code of countries) {
    const country = countryByCode(code);
    if (country) regions.add(country.region);
  }

  return regions.size > 0 ? [...regions] : [GLOBAL_DESTINATION];
}
