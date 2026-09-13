#!/usr/bin/env node
/**
 * Builds the production editorial pictures in `public/visuals/` from the source PNGs.
 *
 *   node scripts/process-editorial-images.mjs [--source <dir>] [--only <file.jpg>] [--dry-run]
 *
 * Every row of `editorial-images.manifest.json` is one source → crop → resize → JPEG step:
 *
 *   crop   the largest `ratio` box that fits the source, shrunk by `zoom` (default 1) and
 *          centred on `focus` (fractions of the source), clamped inside the frame
 *   resize to exactly `output` (lanczos3)
 *   encode JPEG with the manifest's `jpeg` options, metadata stripped
 *
 * The sources are only ever READ: nothing is written, renamed or deleted in the source
 * directory. No tone, opacity or text is baked in — overlays belong to the page's CSS
 * (`--ft-cover-*`), titles to live HTML, so a picture is replaced by editing one row and
 * re-running this script.
 *
 * `sharp` is not a dependency of this app: it is resolved through `next`, which ships it for
 * its own image optimisation, so the script uses the exact build the site already runs.
 */
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, '..');
const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve('next/package.json'))('sharp');

const args = process.argv.slice(2);
const flag = (name) => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};
const dryRun = args.includes('--dry-run');
const only = flag('--only');

const manifest = JSON.parse(readFileSync(join(here, 'editorial-images.manifest.json'), 'utf8'));
const sourceDir = resolve(appRoot, flag('--source') ?? manifest.sourceDir);
const outputDir = resolve(appRoot, manifest.outputDir);

/** macOS may hand back Hangul file names decomposed; compare names in NFC. */
const nfc = (name) => name.normalize('NFC');

/** The crop box of one entry, in source pixels. */
function cropBox(sourceWidth, sourceHeight, crop) {
  const [rw, rh] = crop.ratio;
  const zoom = crop.zoom ?? 1;
  if (zoom < 1) throw new Error(`zoom must be >= 1, got ${zoom}`);
  let width = sourceWidth;
  let height = Math.round((sourceWidth * rh) / rw);
  if (height > sourceHeight) {
    height = sourceHeight;
    width = Math.round((sourceHeight * rw) / rh);
  }
  width = Math.round(width / zoom);
  height = Math.round(height / zoom);
  const [fx, fy] = crop.focus;
  const left = Math.min(Math.max(Math.round(fx * sourceWidth - width / 2), 0), sourceWidth - width);
  const top = Math.min(
    Math.max(Math.round(fy * sourceHeight - height / 2), 0),
    sourceHeight - height,
  );
  return { left, top, width, height };
}

function checkManifest(entries, sourceNames) {
  const problems = [];
  const files = new Set();
  const sources = new Set();
  for (const entry of entries) {
    if (files.has(entry.file)) problems.push(`duplicate output ${entry.file}`);
    if (sources.has(nfc(entry.source))) problems.push(`source used twice: ${entry.source}`);
    files.add(entry.file);
    sources.add(nfc(entry.source));
    if (!/^[a-z0-9-]+\.jpg$/u.test(entry.file)) problems.push(`bad output name ${entry.file}`);
  }
  if (sourceNames !== null) {
    for (const name of sourceNames) {
      if (!sources.has(name)) problems.push(`source not mapped (unused): ${name}`);
    }
    for (const source of sources) {
      if (!sourceNames.has(source)) problems.push(`mapped source missing on disk: ${source}`);
    }
  }
  return problems;
}

const kb = (bytes) => `${(bytes / 1024).toFixed(0)}KB`;

async function main() {
  const onDisk = readdirSync(sourceDir).filter((name) => name.toLowerCase().endsWith('.png'));
  const byNfc = new Map(onDisk.map((name) => [nfc(name), name]));
  const problems = checkManifest(manifest.entries, new Set(byNfc.keys()));
  if (problems.length > 0) {
    for (const problem of problems) console.error(`manifest: ${problem}`);
    process.exitCode = 1;
    return;
  }

  mkdirSync(outputDir, { recursive: true });
  const rows = [];
  for (const entry of manifest.entries) {
    if (only !== undefined && entry.file !== only) continue;
    const sourcePath = join(sourceDir, byNfc.get(nfc(entry.source)));
    const meta = await sharp(sourcePath).metadata();
    const box = cropBox(meta.width, meta.height, entry.crop);
    const [width, height] = entry.output;
    const outPath = join(outputDir, entry.file);
    if (!dryRun) {
      await sharp(sourcePath)
        .extract(box)
        .resize(width, height, { fit: 'fill', kernel: 'lanczos3' })
        .jpeg(manifest.jpeg)
        .toFile(outPath);
    }
    rows.push({
      source: entry.source,
      group: entry.group,
      file: entry.file,
      sourceSize: `${meta.width}x${meta.height}`,
      crop: `${box.width}x${box.height}@${box.left},${box.top}`,
      output: `${width}x${height}`,
      scale: (width / box.width).toFixed(2),
      sourceBytes: statSync(sourcePath).size,
      outputBytes: dryRun ? 0 : statSync(outPath).size,
    });
  }

  for (const row of rows) {
    process.stdout.write(
      `${row.file.padEnd(34)} ${row.group.padEnd(8)} ${row.sourceSize} crop ${row.crop.padEnd(20)} -> ${row.output.padEnd(9)} x${row.scale}  ${kb(row.sourceBytes)} -> ${kb(row.outputBytes)}\n`,
    );
  }
  const source = rows.reduce((sum, row) => sum + row.sourceBytes, 0);
  const output = rows.reduce((sum, row) => sum + row.outputBytes, 0);
  process.stdout.write(
    `\n${rows.length} images  ${kb(source)} -> ${kb(output)}${dryRun ? ' (dry run)' : ''}\n`,
  );
  const report = flag('--report');
  if (report !== undefined) {
    writeFileSync(resolve(report), `${JSON.stringify(rows, null, 2)}\n`);
  }
}

await main();
