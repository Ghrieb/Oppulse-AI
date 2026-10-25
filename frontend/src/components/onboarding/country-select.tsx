import { useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import { Flag } from '@/components/resources/flags';
import { Input } from '@/components/ui/input';
import { countryName, GLOBAL_DESTINATION, searchCountries } from '@/lib/countries';
import { cn } from '@/lib/cn';

/**
 * The country picker.
 *
 * Students think in countries, so the step asks for countries. Each one
 * carries its name as real text beside the flag, because a flag is a visual
 * aid and never the data: a country the interface cannot draw falls back to
 * its ISO code rather than showing something wrong.
 *
 * "Global" is a path, not a country, and it says so.
 */
export function CountrySelect({
  value,
  onChange,
  id = 'country-select',
}: {
  value: string[];
  onChange: (countries: string[]) => void;
  id?: string;
}) {
  const [term, setTerm] = useState('');
  const results = searchCountries(term);
  const isGlobal = value.includes(GLOBAL_DESTINATION);

  const toggle = (iso2: string) => {
    if (value.includes(iso2)) {
      onChange(value.filter((entry) => entry !== iso2));
      return;
    }
    // Picking a country replaces "no preference" — the two cannot both hold.
    onChange([...value.filter((entry) => entry !== GLOBAL_DESTINATION), iso2]);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-search`} className="text-sm font-medium text-text">
          Search countries
        </label>
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-muted"
          />
          <Input
            id={`${id}-search`}
            type="search"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Netherlands, Canada, Germany…"
            className="pl-9"
          />
        </div>
      </div>

      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Selected countries">
          {value.map((iso2) => (
            <li key={iso2}>
              <button
                type="button"
                onClick={() => toggle(iso2)}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-primary/40 bg-primary/5 py-1 pr-2 pl-2 text-meta font-medium text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
              >
                {iso2 === GLOBAL_DESTINATION ? (
                  <span aria-hidden="true" className="text-xs">
                    ◎
                  </span>
                ) : (
                  <Flag iso2={iso2} className="size-4" />
                )}
                <span>{iso2 === GLOBAL_DESTINATION ? 'Global' : countryName(iso2)}</span>
                <X aria-hidden="true" className="size-3" />
                <span className="sr-only">
                  Remove {iso2 === GLOBAL_DESTINATION ? 'Global' : countryName(iso2)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">Countries</legend>

        <label
          className={cn(
            'flex min-h-11 cursor-pointer items-center gap-3 rounded-button border p-3 text-sm transition-colors',
            isGlobal
              ? 'border-primary/50 bg-primary/5 text-text'
              : 'border-border bg-surface text-text hover:bg-surface-subtle',
          )}
        >
          <input
            type="checkbox"
            checked={isGlobal}
            onChange={() => onChange(isGlobal ? [] : [GLOBAL_DESTINATION])}
            className="size-4 accent-[var(--color-primary)]"
          />
          <span aria-hidden="true" className="text-sm">
            ◎
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="font-medium">Global — no preference</span>
            <span className="text-meta text-text-muted">
              Show me anywhere. This is not a country.
            </span>
          </span>
        </label>

        <ul className="scrollbar-subtle max-h-64 overflow-y-auto">
          {results.map((country) => {
            const selected = value.includes(country.iso2);

            return (
              <li key={country.iso2}>
                <label
                  className={cn(
                    'flex min-h-11 cursor-pointer items-center gap-3 rounded-button border p-3 text-sm transition-colors',
                    selected
                      ? 'border-primary/50 bg-primary/5 text-text'
                      : 'border-border bg-surface text-text hover:bg-surface-subtle',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggle(country.iso2)}
                    className="size-4 accent-[var(--color-primary)]"
                  />
                  {country.iso2 === GLOBAL_DESTINATION ? null : (
                    <Flag iso2={country.iso2} className="size-4" />
                  )}
                  <span className="font-medium">{country.name}</span>
                  <span className="text-meta text-text-muted">{country.iso2}</span>
                  {selected ? (
                    <Check aria-hidden="true" className="ml-auto size-4 text-primary" />
                  ) : null}
                </label>
              </li>
            );
          })}
        </ul>

        {results.length === 0 ? (
          <p className="text-meta text-text-muted">
            No country matches “{term}”. Try a different spelling, or choose Global.
          </p>
        ) : null}
      </fieldset>
    </div>
  );
}
