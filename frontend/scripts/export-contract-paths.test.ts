import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * Exports the HTTP contract, then checks what it says.
 *
 * The exporter is the only writer of `contracts/paths.json`, so the test runs
 * it and reads the artifact it produced: the coverage rules are proven against
 * the real source tree, not against fixtures.
 */

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const exporter = resolve(here, 'export-contract-paths.mjs');

type Coverage = { kind: string; callers?: string[]; reason?: string };
type Route = { method: string; path: string; coverage?: Coverage };
type Contract = { version: number; routes: Route[] };
type Deferred = { routes: { method: string; path: string; reason: string }[] };

function route(contract: Contract, method: string, path: string): Route {
  const match = contract.routes.find((entry) => entry.method === method && entry.path === path);
  if (!match) throw new Error(`${method} ${path} is not a contract route.`);
  return match;
}

describe('the contract export', () => {
  let contract: Contract;
  let deferred: Deferred;

  beforeAll(() => {
    execFileSync(process.execPath, [exporter], { stdio: 'pipe' });
    contract = JSON.parse(readFileSync(resolve(root, 'contracts/paths.json'), 'utf-8')) as Contract;
    deferred = JSON.parse(
      readFileSync(resolve(root, 'contracts/deferred.json'), 'utf-8'),
    ) as Deferred;
  });

  it('covers every route with a caller or a deferred marker', () => {
    expect(contract.routes.length).toBeGreaterThan(50);

    const uncovered = contract.routes.filter(
      (entry) => entry.coverage?.kind !== 'hook' && entry.coverage?.kind !== 'deferred',
    );
    expect(uncovered).toEqual([]);
  });

  it('mirrors the deferred list into the coverage it exports', () => {
    const marked = contract.routes
      .filter((entry) => entry.coverage?.kind === 'deferred')
      .map((entry) => `${entry.method} ${entry.path}`)
      .sort();
    const listed = deferred.routes.map((entry) => `${entry.method} ${entry.path}`).sort();

    expect(marked).toEqual(listed);

    for (const entry of deferred.routes) {
      expect(route(contract, entry.method, entry.path).coverage).toEqual({
        kind: 'deferred',
        reason: entry.reason,
      });
    }
  });

  it('matches callers that spell their params differently than the handler', () => {
    // The hook says `${applicationId ?? ''}`; the handler says `:id`.
    expect(route(contract, 'GET', '/api/v1/applications/:id/drafts').coverage).toEqual({
      kind: 'hook',
      callers: ['lib/queries.ts'],
    });
    expect(route(contract, 'POST', '/api/v1/assistant/messages').coverage).toEqual({
      kind: 'hook',
      callers: ['app/agent-provider.tsx'],
    });
    // The hook says `${runId}`; the handler says `:id`.
    expect(route(contract, 'POST', '/api/v1/runs/:id/cancel').coverage).toEqual({
      kind: 'hook',
      callers: ['lib/queries.ts'],
    });
  });
});
