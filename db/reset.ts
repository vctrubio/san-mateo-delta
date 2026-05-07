import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pool } from './client';

const here = dirname(fileURLToPath(import.meta.url));

async function run(file: string) {
  const sql = await readFile(join(here, file), 'utf8');
  console.log(`→ applying ${file}`);
  await pool.query(sql);
}

async function main() {
  await run('drop.sql');
  await run('schema.sql');
  console.log('✓ schema reset');
}

main()
  .catch((err) => {
    console.error('✗ reset failed:', err);
    process.exit(1);
  })
  .finally(() => pool.end());
