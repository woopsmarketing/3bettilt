/**
 * The production pictures: `scripts/editorial-images.manifest.json` (what was built from
 * which source), `content/visuals.ts` (what the site uses) and `public/visuals/` (what ships)
 * must describe the same set of files, at the same sizes, each used by one slot.
 *
 * Reads only the built JPEGs — never the source PNGs, which are temporary and not in the repo.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveVisualsDir } from '../components/visual/assetSource.js';
import {
  allVisualAssets,
  INDIVIDUAL_VISUALS,
  PAGE_VISUALS,
  THEME_VISUALS,
  VISUAL_THEMES,
} from './visuals.js';

interface ManifestEntry {
  readonly source: string;
  readonly group: 'brand' | 'category' | 'story';
  readonly file: string;
  readonly crop: {
    readonly ratio: readonly [number, number];
    readonly focus: readonly [number, number];
    readonly zoom?: number;
  };
  readonly output: readonly [number, number];
}

/** The app root, found the way the site finds `public/visuals` (app or monorepo cwd). */
const VISUALS_DIR = resolveVisualsDir();
if (VISUALS_DIR === null) throw new Error('public/visuals not found');
const APP_ROOT = join(VISUALS_DIR, '..', '..');

const manifest = JSON.parse(
  readFileSync(join(APP_ROOT, 'scripts', 'editorial-images.manifest.json'), 'utf8'),
) as { readonly entries: readonly ManifestEntry[] };

/** Width and height from a JPEG's start-of-frame marker. */
function jpegSize(bytes: Buffer): { width: number; height: number } {
  expect(bytes.readUInt16BE(0), 'JPEG SOI').toBe(0xffd8);
  let offset = 2;
  while (offset < bytes.length) {
    const marker = bytes.readUInt16BE(offset);
    const length = bytes.readUInt16BE(offset + 2);
    // SOF0..SOF15 except DHT (C4), JPG (C8) and DAC (CC).
    if (marker >= 0xffc0 && marker <= 0xffcf && ![0xffc4, 0xffc8, 0xffcc].includes(marker)) {
      return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  throw new Error('no SOF marker');
}

/** `… 오후 07_41_38 (2).png` → `07:41`. */
function sourceMinute(source: string): string {
  const match = /(\d\d)_(\d\d)_\d\d(?: \(\d+\))?\.png$/u.exec(source);
  if (match === null) throw new Error(`unexpected source name ${source}`);
  return `${match[1]}:${match[2]}`;
}

const files = (record: Readonly<Record<string, { readonly file: string }>>) =>
  new Set(Object.values(record).map((asset) => asset.file));

describe('production editorial pictures', () => {
  const entries = manifest.entries;

  it('maps every source once, grouped by when it was generated', () => {
    expect(new Set(entries.map((entry) => entry.source.normalize('NFC'))).size).toBe(
      entries.length,
    );
    expect(new Set(entries.map((entry) => entry.file)).size).toBe(entries.length);
    const byGroup = (group: ManifestEntry['group']) =>
      entries.filter((entry) => entry.group === group);
    expect(byGroup('category')).toHaveLength(VISUAL_THEMES.length);
    expect(byGroup('story')).toHaveLength(Object.keys(INDIVIDUAL_VISUALS).length);
    expect(byGroup('brand')).toHaveLength(Object.keys(PAGE_VISUALS).length);
    for (const entry of entries) {
      const minute = sourceMinute(entry.source);
      const expected =
        minute === '07:41'
          ? 'category'
          : minute === '11:53'
            ? 'story'
            : minute >= '06:49' && minute <= '07:10'
              ? 'brand'
              : null;
      expect(entry.group, entry.source).toBe(expected);
    }
  });

  it('builds exactly the registry: themes from the category set, stories from the story set, page slots from the brand set', () => {
    const inGroup = (group: ManifestEntry['group']) =>
      new Set(entries.filter((entry) => entry.group === group).map((entry) => entry.file));
    expect(inGroup('category')).toEqual(
      new Set(VISUAL_THEMES.map((id) => THEME_VISUALS[id].asset.file)),
    );
    expect(inGroup('story')).toEqual(files(INDIVIDUAL_VISUALS));
    expect(inGroup('brand')).toEqual(files(PAGE_VISUALS));

    const registry = new Map(allVisualAssets().map((asset) => [asset.file, asset]));
    expect(registry.size).toBe(entries.length);
    for (const entry of entries) {
      const asset = registry.get(entry.file);
      expect(asset, entry.file).toBeDefined();
      expect([asset?.width, asset?.height], entry.file).toEqual([...entry.output]);
      // The output keeps the crop's ratio (within a pixel of rounding).
      const [rw, rh] = entry.crop.ratio;
      expect(Math.abs(entry.output[0] * rh - entry.output[1] * rw), entry.file).toBeLessThanOrEqual(
        rw,
      );
    }
  });

  it('ships exactly those JPEGs in public/visuals, at the registered size and a web weight', () => {
    const dir = VISUALS_DIR;
    const shipped = readdirSync(dir).filter((name) => !name.startsWith('.'));
    expect(new Set(shipped)).toEqual(new Set(entries.map((entry) => entry.file)));
    for (const asset of allVisualAssets()) {
      const path = join(dir, asset.file);
      const size = jpegSize(readFileSync(path));
      expect(size, asset.file).toEqual({ width: asset.width, height: asset.height });
      const bytes = statSync(path).size;
      expect(bytes, asset.file).toBeGreaterThan(20 * 1024);
      expect(bytes, asset.file).toBeLessThan(300 * 1024);
    }
  });

  it('uses every page slot in exactly one component, by registry key — no file path in a component', () => {
    const srcDir = join(APP_ROOT, 'src');
    const sources: string[] = [];
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (
          /\.tsx?$/u.test(name) &&
          !/\.test\.tsx?$/u.test(name) &&
          !path.endsWith(join('content', 'visuals.ts'))
        )
          // Code only: a doc comment may name a slot or a file without using it.
          sources.push(
            readFileSync(path, 'utf8')
              .replace(/\/\*[\s\S]*?\*\//gu, '')
              .replace(/(^|\s)\/\/.*$/gmu, '$1'),
          );
      }
    };
    walk(srcDir);
    for (const key of Object.keys(PAGE_VISUALS)) {
      const uses = sources.filter(
        (text) => text.includes(`PAGE_VISUALS.${key}`) || text.includes(`slot="${key}"`),
      );
      expect(uses, key).toHaveLength(1);
    }
    for (const asset of allVisualAssets()) {
      for (const text of sources) expect(text.includes(asset.file), asset.file).toBe(false);
    }
  });
});
