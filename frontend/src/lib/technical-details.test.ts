import { describe, expect, it } from 'vitest';
import {
  environmentLabel,
  formatTechnicalDetails,
  type TechnicalDetails,
} from './technical-details';

const FULL: TechnicalDetails = {
  requestId: 'req_abc',
  runId: 'run_xyz',
  errorCode: 'RATE_LIMITED',
  route: '/goals',
  timestamp: '2026-10-22T23:59:00.000Z',
  environment: 'demo · api:mock',
};

describe('technical details', () => {
  it('renders every whitelisted field, and nothing else', () => {
    const text = formatTechnicalDetails(FULL);

    expect(text).toContain('request id: req_abc');
    expect(text).toContain('run id: run_xyz');
    expect(text).toContain('code: RATE_LIMITED');
    expect(text).toContain('route: /goals');
    expect(text).toContain('timestamp: 2026-10-22T23:59:00.000Z');
    expect(text).toContain('environment: demo · api:mock');
    expect(text.split('\n')).toHaveLength(7);
  });

  it('omits the fields it does not know rather than inventing them', () => {
    const text = formatTechnicalDetails({
      errorCode: 'NETWORK',
      route: '/home',
      timestamp: '2026-10-22T23:59:00.000Z',
      environment: 'demo · api:mock',
    });

    expect(text).not.toContain('request id');
    expect(text).not.toContain('run id');
  });

  it('ignores anything beyond the whitelist, even if a caller smuggles it in', () => {
    const smuggled = {
      ...FULL,
      message: 'CV text: Sara Benali, born 1999-01-01',
      details: { dob: '1999-01-01', token: 'secret-token' },
      stack: 'at submitCv (app.ts:10)',
    } as unknown as TechnicalDetails;

    const text = formatTechnicalDetails(smuggled);

    expect(text).not.toContain('Sara Benali');
    expect(text).not.toContain('dob');
    expect(text).not.toContain('secret-token');
    expect(text).not.toContain('stack');
    expect(text).not.toContain('born');
  });

  it('names the product mode and the API mode in the environment line', () => {
    expect(environmentLabel(true, 'demo')).toBe('demo · api:mock');
    expect(environmentLabel(false, 'student_testing')).toBe('student_testing · api:live');
  });
});
