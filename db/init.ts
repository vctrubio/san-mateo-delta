// Convenience: full reset + seed in one process. Equivalent to running
//   bun db:reset && bun db:seed
// but avoids opening/closing two pools.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

function run(script: string) {
  const result = spawnSync('bun', ['run', join(here, script)], {
    stdio: 'inherit',
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run('reset.ts');
run('seed.ts');
