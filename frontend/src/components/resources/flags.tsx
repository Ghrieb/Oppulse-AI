import { cn } from '@/lib/cn';

/**
 * Country flags.
 *
 * Flags are inline SVG rather than emoji: Windows does not render regional
 * indicator pairs, so an emoji flag appears as the letters "NL". They are
 * also drawn here, for the countries most likely to appear in a result set,
 * rather than shipped as a 4 MB catalogue — an unknown country falls back to
 * a generated code chip instead of a wrong flag.
 *
 * Every flag is decorative: the country name is always real text beside it.
 */

const STRIPE_HEIGHT = 40 / 13;

function Stripes({ colors }: { colors: string[] }) {
  return (
    <>
      {colors.map((color, index) => (
        <rect
          key={index}
          x="0"
          y={index * STRIPE_HEIGHT}
          width="60"
          height={STRIPE_HEIGHT}
          fill={color}
        />
      ))}
    </>
  );
}

function VerticalBands({ colors }: { colors: string[] }) {
  const width = 60 / colors.length;

  return (
    <>
      {colors.map((color, index) => (
        <rect key={index} x={index * width} y="0" width={width} height="40" fill={color} />
      ))}
    </>
  );
}

const US_STRIPES = Array.from({ length: 13 }, (_, index) =>
  index % 2 === 0 ? '#B22234' : '#FFFFFF',
);

const GR_STRIPES = Array.from({ length: 9 }, (_, index) =>
  index % 2 === 0 ? '#0D5EAF' : '#FFFFFF',
);

function IndiaChakra() {
  const spokes = Array.from({ length: 12 }, (_, index) => {
    const angle = (index * Math.PI) / 6;
    const inner = 5.2;
    const outer = 6.4;
    return {
      x1: 30 + Math.cos(angle) * inner,
      y1: 20 + Math.sin(angle) * inner,
      x2: 30 + Math.cos(angle) * outer,
      y2: 20 + Math.sin(angle) * outer,
    };
  });

  return (
    <g>
      <circle cx="30" cy="20" r="6.4" fill="none" stroke="#000080" strokeWidth="1" />
      {spokes.map((spoke, index) => (
        <line
          key={index}
          x1={spoke.x1}
          y1={spoke.y1}
          x2={spoke.x2}
          y2={spoke.y2}
          stroke="#000080"
          strokeWidth="0.8"
        />
      ))}
    </g>
  );
}

function MapleLeaf() {
  return (
    <path
      transform="translate(12.4 2.4) scale(0.55)"
      d="M32 2 L37 16 L47 13 L44 25 L58 25 L44 33 L48 45 L37 40 L36 56 L32 48 L28 56 L27 40 L16 45 L20 33 L6 25 L20 25 L17 13 L27 16 Z"
      fill="#D80621"
    />
  );
}

/**
 * A flag by ISO-3166 alpha-2 code.
 * Returns `null` for a country we do not draw, so the caller can fall back
 * to a code chip rather than showing something inaccurate.
 */
export function Flag({ iso2, className }: { iso2: string; className?: string }) {
  const code = iso2.toUpperCase();

  const content = (() => {
    switch (code) {
      case 'NL':
        return <Stripes colors={['#AE1C28', '#FFFFFF', '#21468B']} />;
      case 'BE':
        return <VerticalBands colors={['#000000', '#FDDA24', '#EF3340']} />;
      case 'FR':
        return <VerticalBands colors={['#002395', '#FFFFFF', '#ED2939']} />;
      case 'DE':
        return <Stripes colors={['#000000', '#DD0000', '#FFCE00']} />;
      case 'ES':
        return (
          <>
            <rect x="0" y="0" width="60" height="10" fill="#AA151B" />
            <rect x="0" y="10" width="60" height="20" fill="#F1BF00" />
            <rect x="0" y="30" width="60" height="10" fill="#AA151B" />
          </>
        );
      case 'IT':
        return <VerticalBands colors={['#008C45', '#F4F5F0', '#CD212A']} />;
      case 'PT':
        return <VerticalBands colors={['#046A38', '#DA291C']} />;
      case 'IE':
        return <VerticalBands colors={['#169B62', '#FFFFFF', '#FF883E']} />;
      case 'GR':
        return (
          <>
            <Stripes colors={GR_STRIPES} />
            <rect x="0" y="0" width="20" height="22.5" fill="#0D5EAF" />
          </>
        );
      case 'JP':
        return (
          <>
            <rect x="0" y="0" width="60" height="40" fill="#FFFFFF" />
            <circle cx="30" cy="20" r="12" fill="#BC002D" />
          </>
        );
      case 'CH':
        return (
          <>
            <rect x="0" y="0" width="60" height="40" fill="#FF0000" />
            <rect x="27" y="0" width="6" height="40" fill="#FFFFFF" />
            <rect x="0" y="17" width="60" height="6" fill="#FFFFFF" />
          </>
        );
      case 'IN':
        return (
          <>
            <Stripes colors={['#FF9933', '#FFFFFF', '#138808']} />
            <IndiaChakra />
          </>
        );
      case 'US':
        return (
          <>
            <Stripes colors={US_STRIPES} />
            <rect x="0" y="0" width="24" height="21.5" fill="#3C3B6E" />
          </>
        );
      case 'CA':
        return (
          <>
            <rect x="0" y="0" width="60" height="40" fill="#FFFFFF" />
            <rect x="0" y="0" width="15" height="40" fill="#D80621" />
            <rect x="45" y="0" width="15" height="40" fill="#D80621" />
            <MapleLeaf />
          </>
        );
      case 'BR':
        return (
          <>
            <rect x="0" y="0" width="60" height="40" fill="#009C3B" />
            <path d="M30 4 L56 20 L30 36 L4 20 Z" fill="#FFDF00" />
            <circle cx="30" cy="20" r="8.5" fill="#002776" />
          </>
        );
      default:
        return null;
    }
  })();

  if (!content) return null;

  return (
    <svg
      viewBox="0 0 60 40"
      aria-hidden="true"
      focusable="false"
      className={cn('shrink-0 rounded-[3px] ring-1 ring-black/10', className)}
    >
      {content}
    </svg>
  );
}
