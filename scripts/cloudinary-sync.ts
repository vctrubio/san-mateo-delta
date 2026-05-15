/**
 * scripts/cloudinary-sync.ts
 *
 * Bulk-upload local images to Cloudinary, mirroring the local folder
 * structure under `san-mateo/`. Idempotent: re-running won't overwrite
 * existing assets (Cloudinary's `overwrite: false`).
 *
 * Usage:
 *   bun run cloudinary:sync ~/finca-photos
 *   bun run cloudinary:sync ~/finca-photos --dry-run
 *
 * Example mapping:
 *   ~/finca-photos/finca/levante/home/IMG_0001.jpg
 *     → san-mateo/finca/levante/home/IMG_0001
 *
 * The local folder layout must mirror the desired Cloudinary structure
 * (see docs/cloudinary.md). The leading `san-mateo/` prefix is added by
 * this script — your local folder is whatever you organise under it.
 *
 * Auth: reads `CLOUDINARY_URL` from .env.local (the Node SDK picks it up
 * automatically). Run via the package.json `cloudinary:sync` script,
 * which threads `--env-file=.env.local` for you.
 */

import { v2 as cloudinary } from 'cloudinary';
import { readdir } from 'node:fs/promises';
import { join, relative, extname, sep } from 'node:path';

const ROOT_PREFIX = 'san-mateo';
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif']);
const MAX_CONCURRENT = 5;

type FileMapping = { path: string; publicId: string };

async function* walkImages(dir: string): AsyncGenerator<string> {
  let entries: Array<{ name: string; isDirectory: () => boolean; isFile: () => boolean }>;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (e) {
    throw new Error(`Cannot read directory ${dir}: ${(e as Error).message}`);
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue; // skip .DS_Store etc.
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkImages(path);
    } else if (entry.isFile() && IMAGE_EXTS.has(extname(entry.name).toLowerCase())) {
      yield path;
    }
  }
}

function publicIdFor(absPath: string, sourceDir: string): string {
  const rel = relative(sourceDir, absPath);
  const noExt = rel.slice(0, rel.length - extname(rel).length);
  // Normalise path separators in case of Windows.
  return `${ROOT_PREFIX}/${noExt.split(sep).join('/')}`;
}

async function uploadOne(mapping: FileMapping): Promise<'uploaded' | 'skipped' | 'failed'> {
  try {
    // overwrite:false → if a resource with this public_id already exists,
    // Cloudinary returns the existing asset rather than replacing. The
    // response shape is the same, so we just trust the call and move on.
    await cloudinary.uploader.upload(mapping.path, {
      public_id: mapping.publicId,
      overwrite: false,
      resource_type: 'image',
      unique_filename: false,
      use_filename: false,
    });
    return 'uploaded';
  } catch (err) {
    const msg = (err as { message?: string })?.message ?? String(err);
    // Cloudinary's "already exists" condition surfaces as an error in
    // some SDK paths — treat it as a skip.
    if (/already exists/i.test(msg)) return 'skipped';
    console.error(`  ✗ ${mapping.publicId}: ${msg}`);
    return 'failed';
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const sourceDir = args.find((a) => !a.startsWith('--'));

  if (!sourceDir) {
    console.error('Usage: bun run cloudinary:sync <source-dir> [--dry-run]');
    console.error('  source-dir: local folder whose contents mirror san-mateo/');
    console.error('  --dry-run:  print mappings, do not upload');
    process.exit(1);
  }

  if (!process.env.CLOUDINARY_URL) {
    console.error('CLOUDINARY_URL is missing from the environment.');
    console.error('Either run via `bun run cloudinary:sync ...` (which threads');
    console.error('`--env-file=.env.local`) or export CLOUDINARY_URL manually.');
    process.exit(1);
  }

  console.log('📤 Cloudinary sync');
  console.log(`   source : ${sourceDir}`);
  console.log(`   target : ${ROOT_PREFIX}/...`);
  console.log(`   mode   : ${dryRun ? 'DRY RUN — no uploads' : 'live upload'}`);
  console.log();

  const files: FileMapping[] = [];
  for await (const p of walkImages(sourceDir)) {
    files.push({ path: p, publicId: publicIdFor(p, sourceDir) });
  }

  if (files.length === 0) {
    console.log('No images found under that directory. Exiting.');
    return;
  }

  console.log(`Found ${files.length} image${files.length === 1 ? '' : 's'}.`);
  const preview = files.slice(0, Math.min(5, files.length));
  for (const f of preview) {
    console.log(`  ${f.path}`);
    console.log(`    → ${f.publicId}`);
  }
  if (files.length > preview.length) {
    console.log(`  … and ${files.length - preview.length} more`);
  }
  console.log();

  if (dryRun) {
    console.log('Dry-run complete. Re-run without --dry-run to upload.');
    return;
  }

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;
  let i = 0;

  async function worker() {
    while (i < files.length) {
      const idx = i++;
      const f = files[idx];
      const tag = `[${idx + 1}/${files.length}]`;
      const result = await uploadOne(f);
      if (result === 'uploaded') {
        uploaded++;
        console.log(`${tag} ✓ ${f.publicId}`);
      } else if (result === 'skipped') {
        skipped++;
        console.log(`${tag} — ${f.publicId} (already exists)`);
      } else {
        failed++;
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(MAX_CONCURRENT, files.length) }, worker),
  );

  console.log();
  console.log(`✓ ${uploaded} uploaded · ${skipped} skipped · ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Sync failed:', err);
  process.exit(1);
});
