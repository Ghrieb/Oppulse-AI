import { spawnSync } from 'node:child_process';

/**
 * Checks that the shared rule cases are current.
 *
 * The TypeScript implementation is the reference, so the recorded answers
 * must still be the ones it produces. When they are not, the rule has
 * changed on one side only, and the build fails rather than the two
 * implementations drifting apart.
 *
 * Regenerate them deliberately with `npm run cases:update`.
 */
const result = spawnSync('npx', ['vitest', 'run', 'scripts/rule-cases.test.ts'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, UPDATE_RULE_CASES: '' },
});

process.exit(result.status ?? 1);
