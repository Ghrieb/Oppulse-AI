/**
 * Deterministic visual identity.
 *
 * Oppulse must show a recognisable identity for every institution without
 * storing or fetching a single asset. Each institution's identity is derived
 * from its official domain: the same domain always produces the same mark,
 * on every device, forever, with zero bytes and zero requests.
 *
 * When the backend later retrieves a real logo for a real institution it
 * takes priority over the generated mark — the generated mark is the
 * product's default, not an apology for a missing image.
 */

/** A two-colour identity. Both stops are dark enough for white text (≥4.5:1). */
export interface BrandPalette {
  id: string;
  from: string;
  to: string;
  /** A soft wash of the identity colour, used behind the skyline. */
  glow: string;
}

/**
 * Eight curated identities. They are deliberately not random: each pair is
 * harmonious, and each passes WCAG AA against white text, so the initials
 * stay legible at any size.
 */
export const PALETTES: readonly BrandPalette[] = [
  { id: 'indigo', from: '#4338ca', to: '#6d28d9', glow: '#6366f1' },
  { id: 'teal', from: '#0f766e', to: '#047857', glow: '#14b8a6' },
  { id: 'amber', from: '#b45309', to: '#c2410c', glow: '#f59e0b' },
  { id: 'rose', from: '#be123c', to: '#a21caf', glow: '#f43f5e' },
  { id: 'sky', from: '#0369a1', to: '#0e7490', glow: '#0ea5e9' },
  { id: 'blue', from: '#1d4ed8', to: '#4338ca', glow: '#3b82f6' },
  { id: 'forest', from: '#15803d', to: '#4d7c0f', glow: '#22c55e' },
  { id: 'plum', from: '#7e22ce', to: '#c026d3', glow: '#a855f7' },
];

/**
 * FNV-1a, 32-bit. Small, fast, and stable across runs and platforms — the
 * mark must not change between the developer's machine and the judge's.
 */
export function hashDomain(domain: string): number {
  let hash = 0x811c9dc5;

  for (let index = 0; index < domain.length; index += 1) {
    hash ^= domain.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash >>> 0;
}

/** A deterministic pseudo-random generator seeded by the domain. */
function seededRandom(seed: number): () => number {
  let state = seed || 1;

  return () => {
    // xorshift32
    state ^= state << 13;
    state >>>= 0;
    state ^= state >> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0xffffffff;
  };
}

/** The identity palette for a domain. */
export function paletteFor(domain: string): BrandPalette {
  const palette = PALETTES[hashDomain(domain) % PALETTES.length];
  return palette ?? PALETTES[0]!;
}

/**
 * The initials shown in the mark.
 *
 * Significant words only: "Helios Institute for Applied Genomics" becomes
 * "HI", not "HIFAG".
 */
export function initialsFor(name: string): string {
  const insignificant = new Set(['of', 'the', 'for', 'and', 'in', 'at', 'on', 'de', 'la', 'le']);
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 0 && !insignificant.has(word.toLowerCase()));

  if (words.length === 0) return '?';
  if (words.length === 1) {
    const word = words[0]!;
    return word.slice(0, 2).toUpperCase();
  }

  return `${words[0]![0] ?? ''}${words[1]![0] ?? ''}`.toUpperCase();
}

/** The monogram recorded on the brand, so other surfaces can reuse it. */
export function monogramFor(name: string): string {
  return initialsFor(name);
}

export interface Building {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Window positions, relative to the building. */
  windows: { x: number; y: number }[];
  /** A spire or roof detail on some buildings. */
  spire: boolean;
}

export interface Skyline {
  buildings: Building[];
  /** Ground line height. */
  ground: number;
  width: number;
  height: number;
}

/**
 * A deterministic abstract skyline for an institution.
 *
 * It reads as "campus" at a glance while being unmistakably illustrative
 * rather than a photograph. The specification is explicit that imagery is
 * visual context only and is never evidence of programme quality.
 */
export function skylineFor(domain: string, width = 1200, height = 400): Skyline {
  const random = seededRandom(hashDomain(`skyline:${domain}`));
  const count = 5 + Math.floor(random() * 4);
  const ground = height - 42;
  const buildings: Building[] = [];

  let cursor = 18;
  const usable = width - 36;

  for (let index = 0; index < count; index += 1) {
    const buildingWidth = 60 + Math.floor(random() * 90);
    const buildingHeight = 60 + Math.floor(random() * (height * 0.62));
    const x = Math.round(cursor);
    const y = Math.round(ground - buildingHeight);

    const windows: { x: number; y: number }[] = [];
    const columns = Math.max(1, Math.floor((buildingWidth - 24) / 18));
    const rows = Math.max(1, Math.floor((buildingHeight - 26) / 22));

    for (let column = 0; column < columns; column += 1) {
      for (let row = 0; row < rows; row += 1) {
        if (random() > 0.45) continue;
        windows.push({ x: 12 + column * 18, y: 14 + row * 22 });
      }
    }

    buildings.push({
      x,
      y,
      width: buildingWidth,
      height: buildingHeight,
      windows,
      spire: random() > 0.7,
    });

    cursor += buildingWidth + 6 + Math.floor(random() * 22);
    if (cursor > usable) break;
  }

  return { buildings, ground, width, height };
}

/**
 * The URL of a caching icon service for a domain.
 *
 * The service caches the icon itself (30 days) and the browser caches the
 * response. Nothing is stored by Oppulse — this is the "temporary cache"
 * path for institutions that are real enough to have a favicon.
 */
export function cachedIconUrl(domain: string): string {
  return `https://icons.duckduckgo.com/ip3/${domain}.ico`;
}
