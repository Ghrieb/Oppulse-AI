import { describe, expect, it } from 'vitest';
import {
  PALETTES,
  cachedIconUrl,
  hashDomain,
  initialsFor,
  monogramFor,
  paletteFor,
  skylineFor,
} from './brand';

/** Relative luminance, for the contrast assertion below. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function contrastRatio(foreground: string, background: string): number {
  const first = luminance(foreground);
  const second = luminance(background);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('brand identity', () => {
  it('is deterministic for a given domain', () => {
    expect(hashDomain('helios-fellowship.org')).toBe(hashDomain('helios-fellowship.org'));
    expect(paletteFor('helios-fellowship.org')).toEqual(paletteFor('helios-fellowship.org'));
  });

  it('gives different institutions different identities', () => {
    const domains = [
      'helios-fellowship.org',
      'atlas-scholarship.ca',
      'meridian-ai.eu',
      'sable-foundation.org',
    ];
    const identities = new Set(domains.map((domain) => paletteFor(domain).id));

    // Not a guarantee for every pair, but a collision across four very
    // different institutions would mean the hash is broken.
    expect(identities.size).toBeGreaterThanOrEqual(3);
  });

  it('keeps white monogram text legible on every palette', () => {
    for (const palette of PALETTES) {
      expect(contrastRatio('#FFFFFF', palette.from)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio('#FFFFFF', palette.to)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('builds initials from significant words only', () => {
    expect(initialsFor('Helios Institute for Applied Genomics')).toBe('HI');
    expect(initialsFor('Atlas Foundation')).toBe('AF');
    expect(initialsFor('Rivermouth Institute')).toBe('RI');
    expect(initialsFor('Verdant Research Network')).toBe('VR');
  });

  it('copes with a single word and with punctuation', () => {
    expect(initialsFor('Meridian')).toBe('ME');
    expect(initialsFor("Sable Foundation's Fund")).toBe('SF');
    expect(initialsFor('   ')).toBe('?');
  });

  it('exposes the monogram for reuse on other surfaces', () => {
    expect(monogramFor('Helios Institute')).toBe('HI');
  });

  it('builds a skyline that stays inside its canvas', () => {
    const skyline = skylineFor('verdant-fellowship.eu', 1200, 400);

    expect(skyline.buildings.length).toBeGreaterThanOrEqual(4);
    for (const building of skyline.buildings) {
      expect(building.x).toBeGreaterThanOrEqual(0);
      expect(building.x + building.width).toBeLessThanOrEqual(1200);
      expect(building.y).toBeGreaterThanOrEqual(0);
      expect(building.y + building.height).toBeLessThanOrEqual(skyline.ground);
    }
  });

  it('builds the same skyline every time', () => {
    expect(skylineFor('verdant-fellowship.eu')).toEqual(skylineFor('verdant-fellowship.eu'));
  });

  it('points the icon service at the official domain', () => {
    expect(cachedIconUrl('ethz.ch')).toBe('https://icons.duckduckgo.com/ip3/ethz.ch.ico');
  });
});
