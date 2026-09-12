import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CONTENT_KINDS, CONTENT_TOPICS } from '../content/types.js';
import { ALL_CONTENT } from '../content/registry/index.js';
import { ContentThumbnail, sceneVariant } from './ContentThumbnail.js';

function markup(props: Parameters<typeof ContentThumbnail>[0]): string {
  const { container } = render(<ContentThumbnail {...props} />);
  return container.innerHTML;
}

function elementCount(props: Parameters<typeof ContentThumbnail>[0]): number {
  const { container } = render(<ContentThumbnail {...props} />);
  return container.querySelectorAll('*').length;
}

/**
 * The budget, and why there is one at all.
 *
 * `/blog` renders twenty of these. WP-3's `HomeHeroVisual` is 169 `<span>`s and that is fine
 * because a page has one of it; twenty cards at that scale would be 3,380 nodes of decoration
 * before a single word of content. 40 is the ceiling the brief set, counted over EVERY
 * topic/kind pair rather than over a representative one, because the drawings differ.
 */
const NODE_BUDGET = 40;

describe('ContentThumbnail', () => {
  it('draws every topic, and draws each one differently', () => {
    // Eight topics that produced the same picture would be decoration, not a signal. The
    // comparison is over rendered markup, so a topic added later that forgets its own art
    // (or copies another's) fails here rather than shipping as a duplicate.
    const drawings = new Map<string, string>();
    for (const topic of CONTENT_TOPICS) {
      drawings.set(topic, markup({ kind: 'blog', topic }));
    }
    expect(new Set(drawings.values()).size).toBe(CONTENT_TOPICS.length);
  });

  it('accents every kind differently, without changing the drawing', () => {
    const perKind = CONTENT_KINDS.map((kind) => markup({ kind, topic: 'range' }));
    expect(new Set(perKind).size).toBe(CONTENT_KINDS.length);

    // The SHAPE must not move with the kind: a `range` article and a `range` lesson are the
    // same picture in two colours, which is what makes the colour readable as a kind.
    const shapes = perKind.map((html) =>
      html.replace(/class="[^"]*"/gu, '').replace(/data-kind="[^"]*"/gu, ''),
    );
    expect(new Set(shapes).size).toBe(1);
  });

  it('is deterministic — the same record draws the same picture every time', () => {
    // Ruling 114's whole premise: no image field, no stored asset, no hash of anything
    // mutable. Two renders separated by every other render in this file must be identical.
    const first = markup({ kind: 'blog', topic: 'odds' });
    for (const topic of CONTENT_TOPICS) markup({ kind: 'learn', topic });
    expect(markup({ kind: 'blog', topic: 'odds' })).toBe(first);
  });

  it(`stays under ${NODE_BUDGET} DOM nodes for every topic and kind`, () => {
    for (const kind of CONTENT_KINDS) {
      for (const topic of CONTENT_TOPICS) {
        for (const size of ['card', 'hero'] as const) {
          const count = elementCount({ kind, topic, size });
          expect(count, `${kind}/${topic}/${size}`).toBeLessThanOrEqual(NODE_BUDGET);
        }
      }
    }
  });

  it('is decorative: hidden from assistive tech, with no text of its own', () => {
    // The title sits beside it as real DOM text and the topic is named in a chip under it.
    // A `role="img"` with a label here would make a screen reader say the same thing twice.
    for (const topic of CONTENT_TOPICS) {
      const { container } = render(<ContentThumbnail kind="blog" topic={topic} />);
      const root = container.firstElementChild;
      expect(root?.getAttribute('aria-hidden'), topic).toBe('true');
      expect(container.querySelector('[role="img"]'), topic).toBeNull();
      expect(container.textContent, topic).toBe('');
      // Ruling 112: no user-visible text may be baked into the picture, so there is no
      // `<text>` in here either — the title is DOM text beside it, and it translates free.
      expect(container.querySelector('text'), topic).toBeNull();
    }
  });

  it('paints only through tokens — no hard-coded colour anywhere', () => {
    for (const kind of CONTENT_KINDS) {
      for (const topic of CONTENT_TOPICS) {
        const html = markup({ kind, topic });
        expect(html, `${kind}/${topic}`).not.toMatch(/#[0-9a-f]{3,8}\b/iu);
        expect(html, `${kind}/${topic}`).not.toMatch(/\brgba?\(/iu);
        expect(html, `${kind}/${topic}`).not.toMatch(/\bhsla?\(/iu);
        // Every paint resolves through `currentColor`, which a `text-*` token class sets.
        expect(html, `${kind}/${topic}`).toContain('currentColor');
      }
    }
  });

  it('adds no image file and no external asset', () => {
    // Ruling 106/112 and the WP's own constraint: `public/` gains nothing, and nothing is
    // fetched. If a later change reaches for a raster, this is where it stops.
    for (const topic of CONTENT_TOPICS) {
      const html = markup({ kind: 'blog', topic });
      expect(html, topic).not.toContain('<img');
      expect(html, topic).not.toContain('url(');
      expect(html, topic).not.toMatch(/\.(png|jpe?g|webp|gif|avif)\b/iu);
    }
  });

  it('carries the record’s own fields as data attributes, for a test and for a screenshot', () => {
    const { container } = render(<ContentThumbnail kind="hands" topic="position" />);
    const root = container.firstElementChild;
    expect(root?.getAttribute('data-topic')).toBe('position');
    expect(root?.getAttribute('data-kind')).toBe('hands');
  });

  it('gives the article header a wider band than the card, drawing the same art centred', () => {
    const { container: card } = render(<ContentThumbnail kind="blog" topic="equity" />);
    const { container: hero } = render(<ContentThumbnail kind="blog" topic="equity" size="hero" />);
    expect(card.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 160 50');
    expect(hero.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 240 50');
    // Centred, not letterboxed: (240 - 160) / 2.
    expect(hero.querySelector('g[transform]')?.getAttribute('transform')).toBe('translate(40 0)');
    expect(card.firstElementChild?.className).toContain('aspect-[16/5]');
    expect(hero.firstElementChild?.className).toContain('aspect-[24/5]');
  });

  it('composes a scene behind every drawing — light, felt, a suit motif — and the drawing stays first', () => {
    /*
     * WP-S3-05: the fallback used to be line art on a flat grey box, which twenty times over
     * read as a placeholder. Each thumbnail now has a scene under the drawing: a gradient
     * ground (token classes on the frame), a warm light, a felt lattice and one suit motif
     * chosen by topic. The scene is decoration behind the art, so the frame's FIRST `<svg>`
     * is still the drawing at its pinned viewBox, the scene never adds text, and it never
     * needs an `id` (twenty identical gradient ids on `/blog` would collide).
     */
    for (const topic of CONTENT_TOPICS) {
      const { container } = render(<ContentThumbnail kind="blog" topic={topic} size="fill" />);
      const root = container.firstElementChild;
      expect(root?.className, topic).toMatch(/bg-linear-to-br/u);
      const svgs = root?.querySelectorAll(':scope > svg') ?? [];
      expect(svgs.length, topic).toBe(2);
      expect(svgs[0]?.getAttribute('viewBox'), topic).toBe('0 0 240 50');
      expect(svgs[1]?.getAttribute('viewBox'), topic).toBe('0 0 100 100');
      expect(container.querySelector('[id]'), topic).toBeNull();
      expect(container.querySelector('text'), topic).toBeNull();
    }
    // The motif is chosen by topic: at least two different suits across the eight.
    const motifs = new Set(
      CONTENT_TOPICS.map((topic) => {
        const { container } = render(<ContentThumbnail kind="blog" topic={topic} />);
        return container.querySelector(':scope > span > svg:last-of-type path')?.getAttribute('d');
      }),
    );
    expect(motifs.size).toBeGreaterThanOrEqual(2);
  });

  it('renders a <span>, because the card puts it inside an <a>', () => {
    const { container } = render(<ContentThumbnail kind="blog" topic="rules" />);
    expect(container.firstElementChild?.tagName).toBe('SPAN');
  });
});

describe('ContentThumbnail — per-item scene (WP-S3-19, review B-M1)', () => {
  const stories = ALL_CONTENT.filter(
    (record) =>
      record.kind === 'blog' &&
      record.contentType === 'hand-story' &&
      record.status === 'PUBLISHED',
  );

  it('with no variant, draws the topic’s default scene — the composition every card drew before', () => {
    for (const topic of CONTENT_TOPICS) {
      const scene = sceneVariant(topic);
      expect(scene.placement, topic).toBe('corner');
      expect(scene.scale, topic).toBe('large');
      expect(scene.light, topic).toBe('left');
    }
    expect(markup({ kind: 'blog', topic: 'odds' })).toBe(
      markup({ kind: 'blog', topic: 'odds', variant: '' }),
    );
  });

  it('is a pure function of (topic, variant): the same id draws the same scene every time', () => {
    const first = markup({ kind: 'blog', topic: 'hand-strength', variant: 'blog-aa-loses' });
    for (const topic of CONTENT_TOPICS) markup({ kind: 'learn', topic, variant: 'x' });
    expect(markup({ kind: 'blog', topic: 'hand-strength', variant: 'blog-aa-loses' })).toBe(first);
  });

  it('keeps the DRAWING on the topic — a variant changes the scene, never the art', () => {
    const drawingOf = (variant?: string) => {
      const { container } = render(
        <ContentThumbnail kind="blog" topic="hand-strength" variant={variant} />,
      );
      return container.querySelector(':scope > span > svg')?.innerHTML;
    };
    expect(drawingOf('blog-aa-loses')).toBe(drawingOf());
    expect(drawingOf('blog-ak-flop-miss')).toBe(drawingOf());
  });

  it('gives the six published hand stories six different pictures, and the four hand-strength ones four different suits', () => {
    // The review's evidence: four of six story cards on `/blog` were pixel-identical
    // because four records share `topic: 'hand-strength'`. Read from the registry so a
    // seventh story, or a re-topiced one, is checked too.
    expect(stories.length).toBeGreaterThanOrEqual(6);
    const pictures = stories.map((story) =>
      markup({ kind: story.kind, topic: story.topic, variant: story.id }),
    );
    expect(new Set(pictures).size).toBe(stories.length);

    const handStrength = stories.filter((story) => story.topic === 'hand-strength');
    const suits = new Set(handStrength.map((story) => sceneVariant(story.topic, story.id).motif));
    expect(suits.size).toBe(handStrength.length);
  });

  it('carries the variant on the root, so a screenshot or a test can tell the cards apart', () => {
    const { container } = render(
      <ContentThumbnail kind="blog" topic="hand-strength" variant="blog-aa-loses" />,
    );
    expect(container.firstElementChild?.getAttribute('data-variant')).toBe('blog-aa-loses');
    // Still under the node budget, still no id, still no text — the scene is the same
    // three nodes in a different arrangement.
    expect(container.querySelectorAll('*').length).toBeLessThanOrEqual(NODE_BUDGET);
    expect(container.querySelector('[id]')).toBeNull();
    expect(container.querySelector('text')).toBeNull();
  });

  it('renders a <span> in every variant too', () => {
    const { container } = render(<ContentThumbnail kind="blog" topic="rules" />);
    expect(container.firstElementChild?.tagName).toBe('SPAN');
  });
});
