import { useId, useMemo, useState } from 'react';
import { cachedIconUrl, initialsFor, paletteFor } from '@/lib/brand';
import type { InstitutionBrand } from '@/lib/schemas';
import { cn } from '@/lib/cn';

/**
 * Institution identity.
 *
 * Three layers, in order of preference:
 *
 *  1. `brand.logoUrl` — an asset the backend validated and returned inline.
 *  2. A caching icon service — only for a brand the backend has verified as a
 *     real institution. The service caches the icon; Oppulse stores nothing.
 *  3. The generated mark — derived from the official domain, so the same
 *     institution always looks the same. This is the default, not an
 *     apology: it is a designed identity, and it costs nothing.
 *
 * No layer can leave a broken image or shift the layout.
 *
 * `source` controls whether a real asset is used at all. List views pass
 * `generated` so a page of twenty results costs zero image requests; the
 * deep analysis passes `asset` because one request per page is within the
 * performance budget.
 */
export function InstitutionLogo({
  brand,
  size = 40,
  className,
  source = 'generated',
}: {
  brand: InstitutionBrand;
  size?: number | undefined;
  className?: string | undefined;
  source?: 'generated' | 'asset' | undefined;
}) {
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());

  const sources = useMemo(() => {
    if (source === 'generated') return [];

    const list: string[] = [];
    if (brand.logoUrl) list.push(brand.logoUrl);
    if (brand.iconSource === 'cache') list.push(cachedIconUrl(brand.officialDomain));
    return list;
  }, [brand, source]);

  const src = sources.find((candidate) => !failed.has(candidate));

  if (src) {
    return (
      <img
        src={src}
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        className={cn('shrink-0 rounded-full object-cover', className)}
        style={{ width: size, height: size }}
        onError={() => {
          setFailed((previous) => new Set(previous).add(src));
        }}
      />
    );
  }

  return <GeneratedMark brand={brand} size={size} className={className} />;
}

/**
 * The generated mark.
 *
 * A seal built from the institution's official domain: the domain seeds a
 * curated two-colour identity and the initials sit in the centre. Rendered
 * as inline SVG so it inherits the product's typeface and stays crisp.
 */
export function GeneratedMark({
  brand,
  size = 40,
  className,
}: {
  brand: InstitutionBrand;
  size?: number | undefined;
  className?: string | undefined;
}) {
  const gradientId = useId();
  const palette = paletteFor(brand.officialDomain);
  const mono = initialsFor(brand.institutionName);

  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role="img"
      aria-label={`${brand.institutionName} mark`}
      className={cn('shrink-0', className)}
      style={{ width: size, height: size }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={palette.from} />
          <stop offset="100%" stopColor={palette.to} />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="32" fill={`url(#${gradientId})`} />
      <circle
        cx="32"
        cy="32"
        r="29.5"
        fill="none"
        stroke="white"
        strokeOpacity="0.28"
        strokeWidth="2.5"
      />
      <text
        x="32"
        y="33"
        textAnchor="middle"
        dominantBaseline="central"
        fill="white"
        fontSize="24"
        fontWeight="700"
        letterSpacing="-0.5"
        style={{ fontFamily: 'inherit' }}
      >
        {mono}
      </text>
    </svg>
  );
}
