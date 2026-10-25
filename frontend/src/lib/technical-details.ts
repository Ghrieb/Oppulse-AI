/**
 * The copyable technical details behind a failure.
 *
 * A support conversation needs identifiers, not data. The formatter accepts
 * exactly six fields and has no access to the error's message, details or
 * cause, so CV text, a date of birth, a prompt or a token cannot reach the
 * clipboard even by accident (spec §A, line 845).
 */
export interface TechnicalDetails {
  requestId?: string | undefined;
  runId?: string | undefined;
  errorCode: string;
  route: string;
  timestamp: string;
  environment: string;
}

/** The environment label shown in diagnostics: product mode and API mode. */
export function environmentLabel(isMockMode: boolean, productMode: string): string {
  return `${productMode} · api:${isMockMode ? 'mock' : 'live'}`;
}

/** Renders the whitelist as one copyable block. Known fields only. */
export function formatTechnicalDetails(details: TechnicalDetails): string {
  const lines = ['Oppulse technical details'];
  if (details.requestId) lines.push(`request id: ${details.requestId}`);
  if (details.runId) lines.push(`run id: ${details.runId}`);
  lines.push(`code: ${details.errorCode}`);
  lines.push(`route: ${details.route}`);
  lines.push(`timestamp: ${details.timestamp}`);
  lines.push(`environment: ${details.environment}`);
  return lines.join('\n');
}
