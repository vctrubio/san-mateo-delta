/**
 * One-shot OG card generator.
 *
 * Produces 1200×630 JPEG cards in public/og/ for the homepage + every
 * property. Files are committed to git so the deploy doesn't depend on
 * generation at build time.
 *
 * Run after replacing a source image:  bun og:generate
 *
 * Source resolution per property:
 *   public/images/{slug}.png  →  public/images/{slug}.jpg  →  .jpeg
 * The first match wins, output is always .jpg regardless of source format
 * so the URL pattern stays stable (`/og/{slug}.jpg`).
 */

import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'public', 'og');

type Source = { out: string; candidates: string[]; alt: string };

const PROPERTY_SLUGS = ['levante', 'cala', 'estrecho', 'marea', 'duplex'];

const SOURCES: Source[] = [
  {
    out: 'finca.jpg',
    candidates: ['public/finca/banners/FincaBanner.jpg'],
    alt: 'Finca San Mateo banner',
  },
  ...PROPERTY_SLUGS.map<Source>((slug) => ({
    out: `${slug}.jpg`,
    candidates: [
      `public/images/${slug}.png`,
      `public/images/${slug}.jpg`,
      `public/images/${slug}.jpeg`,
    ],
    alt: `${slug} property card`,
  })),
];

async function pickSource(candidates: string[]): Promise<string | null> {
  for (const c of candidates) {
    try {
      await fs.access(path.join(ROOT, c));
      return c;
    } catch {
      // try next
    }
  }
  return null;
}

async function generate(src: Source): Promise<void> {
  const found = await pickSource(src.candidates);
  if (!found) {
    console.warn(
      `[og:generate]  skip ${src.out} — no source matched (${src.candidates.join(', ')})`,
    );
    return;
  }
  const outPath = path.join(OUT_DIR, src.out);
  await sharp(path.join(ROOT, found))
    .resize(1200, 630, { fit: 'cover', position: 'center' })
    .jpeg({ quality: 82, progressive: true, mozjpeg: true })
    .toFile(outPath);
  const stat = await fs.stat(outPath);
  const kb = Math.round(stat.size / 1024);
  console.log(`[og:generate]  ${src.out}  ${kb}KB  ← ${found}`);
}

async function main(): Promise<void> {
  await fs.mkdir(OUT_DIR, { recursive: true });
  for (const src of SOURCES) {
    await generate(src);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
