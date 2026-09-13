import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { THEME_VISUALS, INDIVIDUAL_VISUALS, visualOf } from '../../content/visuals.js';
import { contentById } from '../../content/graph.js';
import { resolveAsset } from './assetSource.js';

describe('resolveAsset', () => {
  const story = contentById('blog-aa-loses');

  it('returns null when no candidate file exists — the slot draws ThemeArt', () => {
    const dir = mkdtempSync(join(tmpdir(), 'visuals-'));
    expect(resolveAsset(visualOf(story), dir)).toBeNull();
    expect(resolveAsset(visualOf(story), null)).toBeNull();
  });

  it('picks up a dropped-in file with no code change, own asset before the theme', () => {
    const dir = mkdtempSync(join(tmpdir(), 'visuals-'));
    writeFileSync(join(dir, THEME_VISUALS.story.asset.file), 'x');
    expect(resolveAsset(visualOf(story), dir)?.src).toBe(
      `/visuals/${THEME_VISUALS.story.asset.file}`,
    );
    const own = INDIVIDUAL_VISUALS[story.id];
    if (own === undefined) throw new Error('fixture story lost its own slot');
    writeFileSync(join(dir, own.file), 'x');
    const resolved = resolveAsset(visualOf(story), dir);
    expect(resolved?.spec.id).toBe(own.id);
    expect(resolved?.path).toBe(join(dir, own.file));
  });
});
