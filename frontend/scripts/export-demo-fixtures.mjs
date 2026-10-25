import { spawnSync } from 'node:child_process';

const result = spawnSync('npx', ['vitest', 'run', 'scripts/export-demo-fixtures.test.ts'], {
  stdio: 'inherit',
  shell: true,
});

process.exit(result.status ?? 1);
