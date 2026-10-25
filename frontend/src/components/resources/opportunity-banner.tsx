import { useId } from 'react';
import { paletteFor, skylineFor } from '@/lib/brand';
import type { InstitutionBrand } from '@/lib/schemas';
import { cn } from '@/lib/cn';

/**
 * Campus visual.
 *
 * A deterministic abstract skyline derived from the institution's official
 * domain. It reads as "campus" at a glance while being unmistakably
 * illustrative rather than a photograph — the specification is explicit
 * that imagery is visual context only and is never evidence of programme
 * quality.
 *
 * Rendered as inline SVG: no network request, no raster decode, no layout
 * shift, and it inherits the product's typography.
 */
export function OpportunityBanner({
  brand,
  programmeTitle,
  className,
}: {
  brand: InstitutionBrand;
  programmeTitle: string;
  className?: string;
}) {
  const gradientId = useId();
  const glowId = useId();
  const palette = paletteFor(brand.officialDomain);
  const skyline = skylineFor(brand.officialDomain);

  return (
    <div
      className={cn(
        'relative isolate overflow-hidden rounded-panel border border-border bg-sidebar',
        className,
      )}
    >
      <svg
        viewBox={`0 0 ${skyline.width} ${skyline.height}`}
        className="block h-full w-full"
        preserveAspectRatio="xMidYMid slice"
        role="img"
        aria-label={`Illustrative visual for ${brand.institutionName}`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0b1730" />
            <stop offset="70%" stopColor="#12224a" />
            <stop offset="100%" stopColor="#0b1730" />
          </linearGradient>
          <radialGradient id={glowId} cx="0.72" cy="0.2" r="0.8">
            <stop offset="0%" stopColor={palette.glow} stopOpacity="0.42" />
            <stop offset="100%" stopColor={palette.glow} stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect width={skyline.width} height={skyline.height} fill={`url(#${gradientId})`} />
        <rect width={skyline.width} height={skyline.height} fill={`url(#${glowId})`} />

        {skyline.buildings.map((building, index) => (
          <g key={`${building.x}-${index}`}>
            <rect
              x={building.x}
              y={building.y}
              width={building.width}
              height={building.height}
              rx="3"
              fill="#16264c"
            />
            {building.spire ? (
              <path
                d={`M ${building.x + building.width / 2} ${building.y - 22} L ${building.x + building.width / 2 + 7} ${building.y} L ${building.x + building.width / 2 - 7} ${building.y} Z`}
                fill="#16264c"
              />
            ) : null}
            {building.windows.map((window, windowIndex) => (
              <rect
                key={windowIndex}
                x={building.x + window.x}
                y={building.y + window.y}
                width="5"
                height="7"
                rx="1"
                fill={palette.glow}
                opacity="0.55"
              />
            ))}
          </g>
        ))}

        <rect
          x="0"
          y={skyline.ground}
          width={skyline.width}
          height={skyline.height - skyline.ground}
          fill="#0a1428"
        />
        <line
          x1="0"
          y1={skyline.ground}
          x2={skyline.width}
          y2={skyline.ground}
          stroke={palette.from}
          strokeOpacity="0.5"
          strokeWidth="2"
        />
      </svg>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5">
        <div className="flex flex-col gap-1">
          <span className="text-lg font-semibold text-white">{brand.institutionName}</span>
          <span className="text-meta text-white/70">{programmeTitle}</span>
        </div>
        <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/70">
          Illustrative visual · not a photograph
        </span>
      </div>
    </div>
  );
}
