import { describe, expect, it } from 'vitest';
import { publishedOfKind } from '../../content/graph.js';
import { ogGlyphs } from './renderOg.js';
import { OG_CARD_KINDS, ogCardCategory, ogCardPath, slugOfOgFile } from './ogCard.js';

describe('per-page OG cards', () => {
  const records = OG_CARD_KINDS.flatMap((kind) => publishedOfKind(kind));

  it('gives every published content page its own card path, round-tripping through the route', () => {
    const paths = records.map(ogCardPath);
    expect(new Set(paths).size).toBe(paths.length);
    for (const record of records) {
      const path = ogCardPath(record);
      expect(path).toBe(`/og/${record.kind}/${record.slug}.png`);
      expect(slugOfOgFile(path.split('/').at(-1) ?? '')).toBe(record.slug);
    }
    expect(slugOfOgFile('../x.png')).toBeNull();
    expect(slugOfOgFile('aks-vs-ako.jpg')).toBeNull();
  });

  it('can draw every character of every title and category with the embedded font subset', () => {
    // A missing glyph renders as nothing on the card. Regenerate `fonts/` when this fails.
    const glyphs = ogGlyphs();
    const missing = new Set<string>();
    for (const record of records) {
      for (const ch of `${record.title}${ogCardCategory(record)}3BETTILT`) {
        if (!glyphs.has(ch)) missing.add(`${ch} (${record.id})`);
      }
    }
    expect([...missing]).toEqual([]);
  });
});
