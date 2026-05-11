// Convenience: schema reset + history-only seed in one shot.
// Mirrors db/init.ts and db/fullseason.ts but uses seed_history.ts.
//
//   bun db:history
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

function run(script: string) {
  const result = spawnSync('bun', ['run', join(here, script)], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run('reset.ts');
run('seed_history.ts');
