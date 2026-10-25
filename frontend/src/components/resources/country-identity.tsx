import { paletteFor } from '@/lib/brand';
import type { CountryIdentity } from '@/lib/schemas';
import { Flag } from './flags';
import { hasFlag } from './flag-registry';
import { cn } from '@/lib/cn';

/**
 * Country identity.
 *
 * The flag is decorative and the country name is always real text, so the
 * information never depends on recognising a flag. When a country has no
 * drawn flag — which is the honest case for a country we have not drawn —
 * a generated code chip is shown instead of something inaccurate.
 */
export function CountryIdentityBadge({
  country,
  size = 'sm',
  showName = true,
  className,
}: {
  country: CountryIdentity;
  size?: 'xs' | 'sm' | 'md';
  showName?: boolean;
  className?: string;
}) {
  const flagSize = { xs: 'h-3 w-[18px]', sm: 'h-3.5 w-[22px]', md: 'h-5 w-7' }[size];
  const chipSize = { xs: 'size-4 text-[9px]', sm: 'size-5 text-[10px]', md: 'size-7 text-xs' }[
    size
  ];

  // A region never has a flag, and a country we have not drawn must not be
  // left blank — both fall back to the generated code chip.
  const showFlag = country.kind === 'country' && hasFlag(country.iso2);

  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5', className)}>
      {showFlag ? (
        <Flag iso2={country.iso2} className={flagSize} />
      ) : (
        <span
          aria-hidden="true"
          className={cn(
            'grid shrink-0 place-items-center rounded-[3px] font-semibold text-white',
            chipSize,
          )}
          style={{ backgroundColor: paletteFor(country.iso2).from }}
        >
          {country.iso2}
        </span>
      )}

      {showName ? <span className="truncate text-sm text-text-muted">{country.name}</span> : null}
    </span>
  );
}
