/**
 * The countries we draw.
 *
 * A country outside this list gets a generated code chip instead of a flag,
 * because an approximate or invented flag is worse than no flag.
 *
 * This lives apart from the component so that the list of supported codes
 * can be imported without pulling in the flag artwork.
 */
export const SUPPORTED_FLAG_CODES = new Set([
  'NL',
  'BE',
  'FR',
  'DE',
  'ES',
  'IT',
  'PT',
  'IE',
  'GR',
  'JP',
  'CH',
  'IN',
  'US',
  'CA',
  'BR',
]);

/** Whether a flag is drawn for this country. */
export function hasFlag(iso2: string): boolean {
  return SUPPORTED_FLAG_CODES.has(iso2.toUpperCase());
}
