/**
 * Deterministic identifiers.
 *
 * Derived records — a next action, a transient run marker — need a stable
 * identifier that is a valid UUID, so the same input always produces the
 * same id. That keeps derived state comparable between the mock, the client
 * and the backend, and keeps React keys stable across refetches.
 */

function hashStep(seed: string, salt: number): number {
  let hash = 0x811c9dc5 ^ salt;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash >>> 0;
}

/** A deterministic RFC-4122-shaped UUID derived from a seed string. */
export function deterministicUuid(seed: string): string {
  const parts: string[] = [];

  for (let index = 0; index < 4; index += 1) {
    parts.push(hashStep(seed, index).toString(16).padStart(8, '0'));
  }

  const hex = parts.join('').slice(0, 32).split('');

  // Version 4 and the RFC 4122 variant, so the value is a well-formed UUID.
  hex[12] = '4';
  hex[16] = ((Number.parseInt(hex[16] ?? '0', 16) & 0x3) | 0x8).toString(16);

  const value = hex.join('');
  return [
    value.slice(0, 8),
    value.slice(8, 12),
    value.slice(12, 16),
    value.slice(16, 20),
    value.slice(20, 32),
  ].join('-');
}
