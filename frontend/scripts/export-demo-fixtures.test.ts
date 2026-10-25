import { describe, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInitialState } from '../src/mocks/state';

/**
 * Exports the demo fixtures.
 *
 * The frontend's fixtures are the demo data, and the backend seeds itself
 * from the same file: one source of truth, so the prototype and the real
 * service start from the same world.
 *
 * Run it with `npm run fixtures:export`.
 */

const here = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(here, '../../contracts/demo-fixtures.json');

describe('the demo fixtures', () => {
  it('are exported for the backend to seed from', () => {
    const state = createInitialState();

    const payload = {
      version: 1,
      note: 'The demo data. The backend seeds itself from this file.',
      user: state.user,
      profile: state.profile,
      documents: state.documents,
      opportunities: state.opportunities,
      sources: state.sources,
      evidence: state.evidence,
      matches: state.matches,
      missions: state.missions,
      runs: state.runs,
      runEvents: state.runEvents,
      applications: state.applications,
      drafts: state.drafts,
      monitorTargets: state.monitorTargets,
      monitorEvents: state.monitorEvents,
      alerts: state.alerts,
    };

    writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
  });
});
