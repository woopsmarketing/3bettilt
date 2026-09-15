// @vitest-environment node
/**
 * The OG card with its production photo behind it. Until real assets existed this path never
 * ran; an `undefined` style key made Satori throw and every `/og/*.png` answered 500.
 */
import { describe, expect, it } from 'vitest';
import { resolveAsset } from '../../components/visual/assetSource.js';
import { contentBySlug } from '../../content/graph.js';
import type { AnyContentRecord, ContentKind } from '../../content/types.js';
import { visualOf } from '../../content/visuals.js';
import { OG_CARD_HEIGHT, OG_CARD_WIDTH } from './ogCard.js';
import { renderContentOg } from './renderOg.js';

function record(kind: ContentKind, slug: string): AnyContentRecord {
  const found = contentBySlug(kind, slug);
  if (found === undefined) throw new Error(`fixture ${kind}/${slug} missing`);
  return found;
}

describe('renderContentOg over the featured visual', () => {
  it.each([
    ['blog', 'qq-vs-72o-flop-227', 'player-stunned-by-qq-vs-72o-flop.jpg'],
    ['hands', 'aa', 'two-face-down-hole-cards.jpg'],
  ] as const)(
    '%s/%s draws a 1200×630 PNG on its own production picture',
    async (kind, slug, file) => {
      const page = record(kind, slug);
      // The card's background source is the page's featured visual, not a separate OG picture.
      expect(resolveAsset(visualOf(page))?.spec.file).toBe(file);
      const png = Buffer.from(await renderContentOg(page).arrayBuffer());
      expect(png.subarray(1, 4).toString('ascii')).toBe('PNG');
      // IHDR: width and height at bytes 16–23.
      expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([OG_CARD_WIDTH, OG_CARD_HEIGHT]);
      // A photo behind the text is far heavier than the flat gradient card.
      expect(png.byteLength).toBeGreaterThan(150 * 1024);
    },
    60_000,
  );
});
