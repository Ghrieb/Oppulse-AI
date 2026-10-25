import type { Match } from '@/lib/schemas';

/**
 * Short labels and tones for the assessment concepts.
 *
 * These live apart from the components so the tight layouts can use
 * compact values while the wider layouts use the full badge text.
 */

export function competitivenessValue(value: Match['competitiveness']): string {
  return { high: 'High', moderate: 'Moderate', low: 'Low', unknown: 'Unknown' }[value];
}

export function competitivenessTone(
  value: Match['competitiveness'],
): 'success' | 'warning' | 'neutral' {
  const tone: Record<Match['competitiveness'], 'success' | 'warning' | 'neutral'> = {
    high: 'warning',
    moderate: 'success',
    low: 'neutral',
    unknown: 'neutral',
  };
  return tone[value];
}

export function confidenceValue(value: Match['confidence']): string {
  return { high: 'High', medium: 'Medium', low: 'Low' }[value];
}

export function confidenceTone(value: Match['confidence']): 'success' | 'warning' | 'neutral' {
  const tone: Record<Match['confidence'], 'success' | 'warning' | 'neutral'> = {
    high: 'success',
    medium: 'warning',
    low: 'neutral',
  };
  return tone[value];
}

export function eligibilityValue(value: Match['eligibility']): string {
  return { likely: 'Likely', unresolved: 'Unresolved', ineligible: 'Not met' }[value];
}
