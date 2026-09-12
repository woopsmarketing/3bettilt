/**
 * @vitest-environment node
 *
 * The example-specific checks the former `j2.test.ts` made on individual entries, moved
 * here unchanged (WP-S3-11 split): the two terms J2 added beyond its assignment, the
 * flush-draw illustration `draw.mdx`/`outs.mdx` share, and the board `nuts.mdx` walks.
 * Each pins a RELATIONSHIP between the prose and the cards, through the product's own
 * evaluator, so the example can be reworded and still be checked.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { makeCard, type Card } from '@gto-self/shared';
import { evaluateHandRank } from '../../../features/tools/handRank.js';
import { glossaryRecords } from '../../graph.js';

const CONTENT_DIR = fileURLToPath(new URL('../../../../content/glossary/', import.meta.url));

function mdxPathFor(slug: string): string {
  return join(CONTENT_DIR, `${slug}.mdx`);
}

/** The two ids J2 added to close the 원페어/포카드 gap in the nine hand categories. */
const ADDED_TERM_IDS = ['term-one-pair', 'term-four-of-a-kind'];

describe('the two added hand-category terms — global alias-collision check', () => {
  // Global, not batch-local: `content.test.ts` forbids an alias colliding with ANY other
  // entry's term/slug/alias across the whole glossary, so this reads the full graph.
  const entries = glossaryRecords();
  const terms = new Map(entries.map((entry) => [entry.term.toLowerCase(), entry.id]));
  const slugs = new Map(entries.map((entry) => [entry.slug.toLowerCase(), entry.id]));
  const aliasOwners = new Map<string, string>();
  for (const entry of entries) {
    for (const alias of entry.aliases) {
      if (!aliasOwners.has(alias.toLowerCase())) aliasOwners.set(alias.toLowerCase(), entry.id);
    }
  }

  it('both ids exist', () => {
    const ids = new Set(entries.map((entry) => entry.id));
    for (const id of ADDED_TERM_IDS) expect(ids.has(id), id).toBe(true);
  });

  it.each(ADDED_TERM_IDS)(
    '%s’s aliases collide with no other entry’s term, slug or alias',
    (id) => {
      const entry = entries.find((candidate) => candidate.id === id);
      expect(entry, id).toBeDefined();
      if (entry === undefined) return;
      const collisions: string[] = [];
      for (const alias of entry.aliases) {
        const key = alias.toLowerCase();
        const termOwner = terms.get(key);
        const slugOwner = slugs.get(key);
        const aliasOwner = aliasOwners.get(key);
        if (termOwner !== undefined && termOwner !== entry.id) {
          collisions.push(`alias "${alias}" is the term of ${termOwner}`);
        }
        if (slugOwner !== undefined && slugOwner !== entry.id) {
          collisions.push(`alias "${alias}" is the slug of ${slugOwner}`);
        }
        if (aliasOwner !== undefined && aliasOwner !== entry.id) {
          collisions.push(`alias "${alias}" is also used by ${aliasOwner}`);
        }
      }
      expect(collisions).toEqual([]);
    },
  );
});

/**
 * A flush-draw illustration has to actually BE a flush draw.
 *
 * `draw.mdx` and `outs.mdx` share one example and both derive a number from it: the prose
 * says four cards of a suit are showing, and `outs.mdx` turns that into "남은 하트 아홉 장이
 * 아웃츠" and then into a `<Fact name="OUTS_PROB" arg="9|FLOP|RIVER" />`. This pins the
 * relationship rather than the card list: whatever cards are shown, one suit appears exactly
 * four times, and the outs the prose claims equal the thirteen of that suit minus the four
 * on display.
 */
describe('draw.mdx / outs.mdx — the shared flush-draw example', () => {
  const SUIT_COUNT_IN_DECK = 13;
  const FLUSH_DRAW_PAGES = ['draw', 'outs'] as const;

  it.each(FLUSH_DRAW_PAGES)('%s.mdx’s flush-draw example really shows four of one suit', (slug) => {
    const source = readFileSync(mdxPathFor(slug), 'utf8');
    const shown = /<PokerCards cards="([^"]+)"/.exec(source);
    expect(shown, `${slug}.mdx has no <PokerCards cards="..."> example`).not.toBeNull();
    const shownCards = shown?.[1];
    expect(shownCards, `${slug}.mdx has no cards in its <PokerCards>`).toBeDefined();
    if (shownCards === undefined) return;

    const bySuit = new Map<string, number>();
    for (const card of shownCards.split(/\s+/)) {
      const suit = card.slice(-1);
      bySuit.set(suit, (bySuit.get(suit) ?? 0) + 1);
    }
    const drawnSuit = [...bySuit.entries()].filter(([, count]) => count === 4);
    expect(
      drawnSuit,
      `${slug}.mdx claims 넉 장 of a suit but shows ${JSON.stringify([...bySuit])}`,
    ).toHaveLength(1);

    // The prose says 넉 장; the cards must agree, in that order of authority.
    expect(source).toContain('넉 장');
  });

  it('outs.mdx’s nine outs are the hearts left after the four it shows', () => {
    const source = readFileSync(mdxPathFor('outs'), 'utf8');
    const shown = /<PokerCards cards="([^"]+)"/.exec(source);
    expect(shown).not.toBeNull();
    const shownCards = shown?.[1];
    expect(shownCards).toBeDefined();
    if (shownCards === undefined) return;

    const cards = shownCards.split(/\s+/);
    const suited = cards.filter((card) => card.endsWith('h')).length;
    const remaining = SUIT_COUNT_IN_DECK - suited;

    // Both the sentence and the Fact argument have to land on the same number.
    const KOREAN = ['', '한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉'];
    expect(source).toContain(`남은 하트 ${KOREAN[remaining] ?? String(remaining)} 장`);
    expect(source).toContain(`arg="${remaining}|FLOP|RIVER"`);
  });
});

/**
 * `nuts.mdx` walks one board — `Ah Kh Qh 7c 2d` — and says which hands can be made on it.
 * A page whose entire subject is "the strongest hand available" has to get that board
 * right. Pinned through `evaluateHandRank` — the same function the Hand Checker tool runs.
 */
describe('nuts.mdx — the board it walks', () => {
  const NUTS_BOARD = 'Ah Kh Qh 7c 2d';

  function cardsOf(text: string): Card[] {
    return text.split(' ').map((token) => {
      const rank = token[0] as Parameters<typeof makeCard>[0];
      const suit = token[1] as Parameters<typeof makeCard>[1];
      return makeCard(rank, suit);
    });
  }

  function categoryWith(hole: string): string {
    const result = evaluateHandRank(cardsOf(hole), cardsOf(NUTS_BOARD));
    expect(result.status).toBe('EVALUATED');
    return result.status === 'EVALUATED' ? result.category : '';
  }

  it('nuts.mdx still uses the board these claims were checked against', () => {
    expect(readFileSync(mdxPathFor('nuts'), 'utf8')).toContain(`cards="${NUTS_BOARD}"`);
  });

  it.each([
    ['Jh Th', 'STRAIGHT_FLUSH', 'the nuts — J and T of hearts complete T-J-Q-K-A'],
    ['9h 4h', 'FLUSH', 'two hearts make a flush, but not the nuts'],
    ['7d 7s', 'TRIPS', 'trips needs the pocket pair'],
    ['7d 3c', 'PAIR', 'ONE more 7 is only a pair — the error this test exists for'],
    ['7d 2s', 'TWO_PAIR', 'a 7 and a 2 make two pair'],
  ])('on the nuts board, %s makes %s (%s)', (hole, expected) => {
    expect(categoryWith(hole)).toBe(expected);
  });

  it('nuts.mdx names the straight flush, not the flush, as this board’s nuts', () => {
    const source = readFileSync(mdxPathFor('nuts'), 'utf8');
    expect(categoryWith('Jh Th')).toBe('STRAIGHT_FLUSH');
    expect(source).toContain('스트레이트 플러시');
    expect(source).not.toContain('7이나 2를 한 장 더 들고 있어서 트리플');
  });
});
