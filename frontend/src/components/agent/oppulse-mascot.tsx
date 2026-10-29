import { cn } from '@/lib/cn';

/**
 * Oppulse's full-body mascot.
 *
 * Hand-drawn SVG (no raster assets) so it stays crisp at any size and ships
 * with the bundle. Two sizes share one drawing:
 *
 * - `hero` — the Home workspace greeting, where the mascot is the visual
 *   anchor of the screen.
 * - `promo` — the sidebar callout, where it sits beside short copy.
 *
 * Decorative by default (`aria-hidden`); pass `label` only when the image
 * carries meaning the adjacent text does not already say.
 */
export function OppulseMascot({
  size = 'hero',
  className,
  label,
}: {
  size?: 'hero' | 'promo';
  className?: string | undefined;
  label?: string | undefined;
}) {
  const sizeClass = size === 'hero' ? 'size-40 sm:size-48 lg:size-56' : 'size-14';

  return (
    <svg
      viewBox="0 0 200 200"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn(sizeClass, 'shrink-0', className)}
    >
      <defs>
        <linearGradient id="oppulse-mascot-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#dfe7f8" />
        </linearGradient>
        <linearGradient id="oppulse-mascot-glow" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7d6cff" />
          <stop offset="100%" stopColor="#5b4bf2" />
        </linearGradient>
        <radialGradient id="oppulse-mascot-cheek" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#7d6cff" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#7d6cff" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Ground shadow */}
      <ellipse cx="100" cy="182" rx="52" ry="9" fill="#0b1730" opacity="0.10" />

      {/* Antenna */}
      <path
        d="M100 44V30"
        stroke="#0b1730"
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="100" cy="24" r="8" fill="url(#oppulse-mascot-glow)" stroke="#0b1730" strokeWidth="4" />

      {/* Ears */}
      <rect x="34" y="78" width="16" height="34" rx="8" fill="#5b4bf2" stroke="#0b1730" strokeWidth="4" />
      <rect x="150" y="78" width="16" height="34" rx="8" fill="#5b4bf2" stroke="#0b1730" strokeWidth="4" />

      {/* Body */}
      <rect
        x="62"
        y="118"
        width="76"
        height="62"
        rx="26"
        fill="url(#oppulse-mascot-body)"
        stroke="#0b1730"
        strokeWidth="5"
      />
      {/* Chest light */}
      <circle cx="100" cy="146" r="11" fill="#5b4bf2" stroke="#0b1730" strokeWidth="4" />
      <circle cx="100" cy="146" r="4" fill="#ffffff" />

      {/* Arms */}
      <path
        d="M64 132c-12 4-18 14-16 26"
        stroke="#0b1730"
        strokeWidth="14"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M64 132c-12 4-18 14-16 26"
        stroke="#ffffff"
        strokeWidth="7"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M136 132c12 4 20 12 20 24"
        stroke="#0b1730"
        strokeWidth="14"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M136 132c12 4 20 12 20 24"
        stroke="#ffffff"
        strokeWidth="7"
        strokeLinecap="round"
        fill="none"
      />
      {/* Wave hand */}
      <circle cx="157" cy="159" r="9" fill="#5b4bf2" stroke="#0b1730" strokeWidth="4" />

      {/* Head */}
      <rect
        x="48"
        y="56"
        width="104"
        height="74"
        rx="30"
        fill="url(#oppulse-mascot-body)"
        stroke="#0b1730"
        strokeWidth="5"
      />

      {/* Cheeks */}
      <circle cx="70" cy="106" r="10" fill="url(#oppulse-mascot-cheek)" />
      <circle cx="130" cy="106" r="10" fill="url(#oppulse-mascot-cheek)" />

      {/* Eyes */}
      <rect x="68" y="78" width="22" height="26" rx="11" fill="#0b1730" />
      <rect x="110" y="78" width="22" height="26" rx="11" fill="#0b1730" />
      <circle cx="76" cy="86" r="4.5" fill="#ffffff" />
      <circle cx="118" cy="86" r="4.5" fill="#ffffff" />

      {/* Smile */}
      <path
        d="M86 114c4 5 10 7 14 7s10-2 14-7"
        stroke="#0b1730"
        strokeWidth="4.5"
        strokeLinecap="round"
        fill="none"
      />

      {/* Visor highlight */}
      <path
        d="M62 74c6-7 14-11 24-12"
        stroke="#ffffff"
        strokeWidth="5"
        strokeLinecap="round"
        opacity="0.65"
        fill="none"
      />

      {/* Feet */}
      <rect x="72" y="176" width="22" height="14" rx="7" fill="#5b4bf2" stroke="#0b1730" strokeWidth="4" />
      <rect x="106" y="176" width="22" height="14" rx="7" fill="#5b4bf2" stroke="#0b1730" strokeWidth="4" />
    </svg>
  );
}
