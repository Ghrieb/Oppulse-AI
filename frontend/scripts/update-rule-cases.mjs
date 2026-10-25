import { spawnSync } from 'node:child_process';

/**
 * Regenerates the shared rule cases.
 *
 * The TypeScript implementation is the reference: this runs the case test
 * with the update flag, which rewrites `contracts/rule-cases.json` with the
 * answers the frontend produces. The Python implementation is then asserted
 * against the same file, so a rule change that only one side implements
 * fails the build rather than drifting.
 */
const result = spawnSync('npx', ['vitest', 'run', 'scripts/rule-cases.test.ts'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, UPDATE_RULE_CASES: '1' },
});

process.exit(result.status ?? 1);
