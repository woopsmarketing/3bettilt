/**
 * Image SEO audit for the production editorial pictures (`content/visuals.ts`).
 *
 * The file name is the crawlable image URL and the `alt` is what a screen reader and an image
 * search both read, so each asset carries an explicit decision: a descriptive, content-named
 * file; a role; and an `alt` that matches the role (`''` is a decision, not an omission).
 * `visualAssets.test.ts` separately holds the registry, the manifest and the JPEG bytes
 * together.
 */
import { render } from '@testing-library/react';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EditorialVisual } from '../components/visual/EditorialVisual.js';
import { resolveVisualsDir } from '../components/visual/assetSource.js';
import { allVisualAssets, PAGE_VISUALS, pageVisual, themeVisual } from './visuals.js';

const VISUALS_DIR = resolveVisualsDir();
if (VISUALS_DIR === null) throw new Error('public/visuals not found');
const APP_ROOT = join(VISUALS_DIR, '..', '..');

/** Lowercase ASCII kebab-case words, `.jpg`, at most 60 characters in all. */
const SEO_FILE = /^[a-z0-9]+(?:-[a-z0-9]+)*\.jpg$/u;
/** Slot-named prefixes the pre-SEO files used; a content name never starts with one. */
const GENERIC_PREFIX = /^(?:image|img|brand|theme|story|home|hero|photo|visual)-/u;

/** The file names these pictures shipped under before the image SEO pass (2026-09-15). */
const RETIRED_FILES = [
  'home-hero.jpg',
  'home-breathing.jpg',
  'home-stage-rules.jpg',
  'home-stage-range-position.jpg',
  'home-stage-postflop-math.jpg',
  'brand-feature.jpg',
  'brand-blog.jpg',
  'brand-learn.jpg',
  'brand-hands.jpg',
  'brand-practice.jpg',
  'brand-glossary.jpg',
  'brand-tools.jpg',
  'brand-about.jpg',
  'brand-about-table.jpg',
  'theme-basics.jpg',
  'theme-rankings.jpg',
  'theme-starting-hands.jpg',
  'theme-range.jpg',
  'theme-position.jpg',
  'theme-betting.jpg',
  'theme-math.jpg',
  'theme-story.jpg',
  'story-qq-vs-72o-flop-227.jpg',
  'story-full-house-loses.jpg',
  'story-qq-three-bet-frustration.jpg',
  'story-river-changes-everything.jpg',
  'story-aa-loses.jpg',
  'story-ak-flop-miss.jpg',
] as const;

const assets = allVisualAssets();

describe('image SEO: production editorial assets', () => {
  it('has one registry entry per shipped picture, with no duplicate file name', () => {
    expect(assets).toHaveLength(28);
    expect(new Set(assets.map((asset) => asset.file)).size).toBe(assets.length);
  });

  it.each(assets.map((asset) => [asset.file, asset] as const))(
    '%s: descriptive file name, real size, explicit role and matching alt',
    (file, asset) => {
      expect(file).toMatch(SEO_FILE);
      expect(file.length).toBeLessThanOrEqual(60);
      expect(file).not.toMatch(GENERIC_PREFIX);
      expect(file).not.toContain('3bettilt');
      // Digits only as a hand name (`72o`), never a sequence number.
      expect(file).not.toMatch(/(?:^|-)\d+(?:-|\.jpg$)/u);
      expect(existsSync(join(VISUALS_DIR, file)), file).toBe(true);

      expect(Number.isInteger(asset.width) && asset.width > 0).toBe(true);
      expect(Number.isInteger(asset.height) && asset.height > 0).toBe(true);

      expect(['informational', 'decorative']).toContain(asset.role);
      expect(typeof asset.alt).toBe('string');
      expect(asset.description.trim()).not.toBe('');
      if (asset.role === 'informational') {
        expect(asset.alt.trim()).not.toBe('');
        // One line, no keyword list, no brand.
        expect(asset.alt.length).toBeLessThanOrEqual(60);
        expect((asset.alt.match(/[,|/·]/gu) ?? []).length).toBeLessThanOrEqual(1);
        expect(asset.alt).not.toMatch(/3bettilt/iu);
      } else {
        expect(asset.alt).toBe('');
      }
    },
  );

  it('keeps the brand slots decorative and every theme and story picture informational', () => {
    for (const asset of Object.values(PAGE_VISUALS))
      expect(asset.role, asset.file).toBe('decorative');
    const counts = { informational: 0, decorative: 0 };
    for (const asset of assets) counts[asset.role] += 1;
    expect(counts).toEqual({ informational: 14, decorative: 14 });
  });

  it('leaves no retired file name in runtime source, tests, scripts or config', () => {
    const self = join('src', 'content', 'imageSeo.test.tsx');
    const roots = ['src', 'tests', 'scripts', 'next.config.ts'].map((path) => join(APP_ROOT, path));
    const hits: string[] = [];
    const scan = (path: string): void => {
      if (statSync(path).isDirectory()) {
        for (const name of readdirSync(path)) scan(join(path, name));
        return;
      }
      if (!/\.(?:tsx?|mjs|json|css|mdx)$/u.test(path) || relative(APP_ROOT, path) === self) return;
      const text = readFileSync(path, 'utf8');
      for (const old of RETIRED_FILES) {
        if (text.includes(old)) hits.push(`${relative(APP_ROOT, path)}: ${old}`);
      }
    };
    for (const root of roots) if (existsSync(root)) scan(root);
    expect(hits).toEqual([]);
    for (const old of RETIRED_FILES) expect(existsSync(join(VISUALS_DIR, old)), old).toBe(false);
  });
});

describe('image SEO: how a slot announces its picture', () => {
  it('is decorative by default — a card, thumbnail or backdrop never repeats its link text', () => {
    const { container } = render(
      <EditorialVisual visual={themeVisual('position')} sizes="100vw" />,
    );
    const img = container.querySelector('img');
    expect(img?.getAttribute('alt')).toBe('');
    expect(img?.hasAttribute('title')).toBe(false);
  });

  it('announces the served asset`s registry alt when the slot opts in with `describe`', () => {
    const visual = themeVisual('position');
    const { container } = render(<EditorialVisual visual={visual} sizes="100vw" describe />);
    const img = container.querySelector('img');
    expect(img?.getAttribute('alt')).toBe(visual.candidates[0]?.alt);
    expect(img?.getAttribute('alt')).not.toBe('');
    // Next/Image stays in charge: the optimised URL carries the new file name.
    expect(decodeURIComponent(img?.getAttribute('src') ?? '')).toContain(
      '/visuals/six-seat-poker-table-top-view.jpg',
    );
    expect(img?.getAttribute('sizes')).toBe('100vw');
  });

  it('keeps a decorative asset silent even where the slot opts in', () => {
    const { container } = render(
      <EditorialVisual
        visual={pageVisual(PAGE_VISUALS.aboutTable, 'betting')}
        sizes="100vw"
        describe
      />,
    );
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('');
  });
});
