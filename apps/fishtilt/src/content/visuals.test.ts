import { describe, expect, it } from 'vitest';
import { publishedOfKind } from './graph.js';
import { LEARN_CATEGORIES } from './registry/learn/categories.js';
import { GLOSSARY_CATEGORIES } from './registry/glossary/categories.js';
import { CONTENT_KINDS } from './types.js';
import {
  allVisualAssets,
  GLOSSARY_CATEGORY_THEME,
  INDIVIDUAL_VISUALS,
  LEARN_CATEGORY_THEME,
  THEME_VISUALS,
  VISUAL_THEMES,
  visualOf,
} from './visuals.js';

describe('featured visual registry', () => {
  it('resolves every published page to a theme, with its own asset first when it has one', () => {
    for (const kind of CONTENT_KINDS) {
      for (const record of publishedOfKind(kind)) {
        const visual = visualOf(record);
        expect(VISUAL_THEMES, record.id).toContain(visual.theme);
        expect(visual.variant).toBe(record.id);
        const theme = THEME_VISUALS[visual.theme].asset;
        expect(visual.candidates.at(-1), record.id).toEqual(theme);
        const own = INDIVIDUAL_VISUALS[record.id];
        if (own === undefined) {
          expect(visual.scope).toBe('theme');
          expect(visual.candidates).toHaveLength(1);
        } else {
          expect(visual.scope).toBe('individual');
          expect(visual.candidates[0]).toEqual(own);
        }
      }
    }
  });

  it('gives every published hand story its own slot, and only records that exist', () => {
    const stories = publishedOfKind('blog').filter(
      (record) => record.kind === 'blog' && record.contentType === 'hand-story',
    );
    expect(stories.length).toBeGreaterThan(0);
    for (const story of stories) expect(INDIVIDUAL_VISUALS[story.id], story.id).toBeDefined();
    const ids = new Set(CONTENT_KINDS.flatMap((kind) => publishedOfKind(kind).map((r) => r.id)));
    for (const id of Object.keys(INDIVIDUAL_VISUALS)) expect(ids.has(id), id).toBe(true);
  });

  it('shares visuals by group: lessons by category, terms by category, hands by one theme', () => {
    for (const category of LEARN_CATEGORIES)
      expect(LEARN_CATEGORY_THEME[category.id]).toBeDefined();
    for (const category of GLOSSARY_CATEGORIES) {
      expect(GLOSSARY_CATEGORY_THEME[category.id]).toBeDefined();
    }
    for (const hand of publishedOfKind('hands'))
      expect(visualOf(hand).theme).toBe('starting-hands');
    // A handful of shared pictures, not one per page.
    const themesInUse = new Set(
      CONTENT_KINDS.flatMap((kind) => publishedOfKind(kind).map((r) => visualOf(r).theme)),
    );
    expect(themesInUse.size).toBeLessThanOrEqual(VISUAL_THEMES.length);
  });

  it('names every asset once, as a JPEG master the page and the OG card can share', () => {
    const assets = allVisualAssets();
    expect(new Set(assets.map((a) => a.file)).size).toBe(assets.length);
    expect(new Set(assets.map((a) => a.id)).size).toBe(assets.length);
    for (const asset of assets) {
      expect(asset.file, asset.id).toMatch(/^[a-z0-9-]+\.jpg$/u);
      // Every picture is described; only an informational one announces it (`imageSeo.test.tsx`).
      expect(asset.description.length, asset.id).toBeGreaterThan(5);
      expect(asset.alt, asset.id).toBe(asset.role === 'informational' ? asset.description : '');
      expect(asset.width).toBeGreaterThan(asset.height * 0.7);
    }
  });
});
