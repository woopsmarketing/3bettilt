/**
 * @vitest-environment node
 *
 * The hand-story gate, exercised on the test-only fixture (`testing/fixtureStory.ts`) and on
 * deliberately broken copies of it. Every expected showdown value below is COMPUTED by
 * `strategy-core`'s evaluator inside the test, never typed from poker knowledge
 * (AGENT_COMMON_RULES rule 3): the assertions compare the resolver's output to `bestFiveOf`
 * run on the same cards.
 */
import { describe, expect, it } from 'vitest';
import { parseCards, Money } from '@gto-self/shared';
import { bestFiveOf, compareHands } from '@gto-self/strategy-core';
import { FIXTURE_STORY, FIXTURE_STORY_MDX } from './testing/fixtureStory.js';
import { resolveStory, formatStoryAmount, storyCards } from './resolve.js';
import { validateHand, validateStory, asHandStory } from './validate.js';
import { storyMdxIssues, expectedStreetTags } from './mdx.js';
import { bb, HAND_STORY_DISCLOSURE, type HandStoryHand } from './types.js';

const HAND = FIXTURE_STORY.hand;

function withHand(over: Partial<HandStoryHand>): HandStoryHand {
  return { ...HAND, ...over };
}

function cards(text: string) {
  const parsed = parseCards(text);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.value;
}

describe('the fixture story', () => {
  it('passes the gate with no issues', () => {
    expect(validateStory(FIXTURE_STORY).issues).toEqual([]);
    expect(validateHand(HAND).ok).toBe(true);
    expect(asHandStory(FIXTURE_STORY).hand).toBe(HAND);
  });

  it('its MDX example has the shape the checker expects', () => {
    expect(storyMdxIssues(FIXTURE_STORY_MDX, HAND)).toEqual([]);
    expect(expectedStreetTags(HAND)).toEqual(['preflop', 'flop', 'turn', 'river', 'showdown']);
  });
});

describe('resolveStory — arithmetic is integer milliBB summed from the actions', () => {
  const resolved = resolveStory(HAND);

  it('posts the blinds as derived rows and sums every street', () => {
    const [preflop, flop, turn, river] = resolved.streets;
    expect(preflop?.rows.slice(0, 2).map((row) => row.derived)).toEqual([true, true]);
    // 0.5 (SB, folded) + 9 (BB) + 9 (BTN)
    expect(preflop?.potAfter).toBe(Money.fromBB(18.5));
    expect(flop?.potAfter).toBe(Money.fromBB(30.5));
    expect(turn?.potAfter).toBe(Money.fromBB(60.5));
    expect(river?.potAfter).toBe(Money.fromBB(120.5));
    expect(resolved.pot).toBe(Money.fromBB(120.5));
    expect(formatStoryAmount(resolved.pot)).toBe('120.5BB');
  });

  it('formats a call as the street wager and a raise as its "to" amount', () => {
    const preflop = resolved.streets[0];
    const call = preflop?.rows.at(-1);
    expect(call?.action).toBe('콜');
    expect(call?.amount).toBe('9BB');
    expect(call?.hero).toBe(true);
    const threeBet = preflop?.rows.at(-2);
    expect(threeBet?.action).toBe('레이즈');
    expect(threeBet?.amount).toBe('9BB');
    expect(threeBet?.note).toBe('3벳');
  });

  it('names the hero class from the cards, never from a typed key', () => {
    expect(resolved.heroClassKey).toBe('QQ');
    expect(resolved.unmentioned).toEqual([]);
  });

  it('scores the showdown with the evaluator and agrees with bestFiveOf on the same cards', () => {
    if (resolved.ending.kind !== 'showdown') throw new Error('fixture must reach a showdown');
    const board = cards(`${HAND.flop} ${HAND.turn} ${HAND.river}`);
    const hero = bestFiveOf([...cards(HAND.heroHand), ...board]);
    const villain = bestFiveOf([...cards(HAND.showdown?.villainHand ?? ''), ...board]);
    expect(resolved.ending.hero.value).toEqual(hero.value);
    expect(resolved.ending.villain.value).toEqual(villain.value);
    const order = compareHands(hero.value.strength, villain.value.strength);
    expect(resolved.ending.winner).toBe(order > 0 ? 'hero' : order < 0 ? 'villain' : 'split');
    expect(resolved.ending.winner).toBe(HAND.showdown?.winner);
  });

  it('lists every dealt card once', () => {
    expect(storyCards(HAND)).toHaveLength(9);
  });
});

describe('validateHand — refuses', () => {
  it('a card dealt twice across hero, villain and board', () => {
    const { issues } = validateHand(withHand({ river: 'Qs' }));
    expect(issues.some((issue) => issue.includes('dealt twice'))).toBe(true);
  });

  it('a malformed card code', () => {
    const { issues } = validateHand(withHand({ turn: 'Kx' }));
    expect(issues.some((issue) => issue.startsWith('turn:'))).toBe(true);
  });

  it('a flop that is not three cards', () => {
    const { issues } = validateHand(withHand({ flop: '2s 2h' }));
    expect(issues.some((issue) => issue.includes('expected 3 card(s)'))).toBe(true);
  });

  it('a river without a turn', () => {
    const { issues } = validateHand(withHand({ turn: undefined, turnActions: undefined }));
    expect(issues).toContain('river is given without a turn');
  });

  it('a declared winner the evaluator disagrees with', () => {
    const { issues } = validateHand(
      withHand({ showdown: { villainHand: '7c 2c', winner: 'hero' } }),
    );
    expect(
      issues.some((issue) => issue.startsWith('showdown: the record declares winner "hero"')),
    ).toBe(true);
  });

  it('a missing or paraphrased disclosure', () => {
    expect(validateHand(withHand({ disclosure: '' })).issues).toContain(
      `disclosure must be exactly "${HAND_STORY_DISCLOSURE}"`,
    );
    expect(validateHand(withHand({ disclosure: '재구성한 시나리오' })).ok).toBe(false);
  });

  it('a check facing a bet', () => {
    const { issues } = validateHand(
      withHand({
        flopActions: [
          { position: 'BB', kind: 'BET', amount: bb(6) },
          { position: 'BTN', kind: 'CHECK' },
        ],
      }),
    );
    expect(issues.some((issue) => issue.includes('cannot check facing 6BB'))).toBe(true);
  });

  it('a street that is not closed (a wager nobody matched)', () => {
    const { issues } = validateHand(
      withHand({ riverActions: [{ position: 'BB', kind: 'BET', amount: bb(30) }] }),
    );
    expect(issues.some((issue) => issue.includes('river: not closed'))).toBe(true);
  });

  it('a call written with the wrong amount', () => {
    const { issues } = validateHand(
      withHand({
        flopActions: [
          { position: 'BB', kind: 'BET', amount: bb(6) },
          { position: 'BTN', kind: 'CALL', amount: bb(5) },
        ],
      }),
    );
    expect(issues.some((issue) => issue.includes('a call is 6BB, not 5BB'))).toBe(true);
  });

  it('a stack that goes past the effective stack', () => {
    const { issues } = validateHand(
      withHand({
        riverActions: [
          { position: 'BB', kind: 'BET', amount: bb(80) },
          { position: 'BTN', kind: 'CALL' },
        ],
      }),
    );
    expect(issues.some((issue) => issue.includes('more than the effective stack'))).toBe(true);
  });

  it('a showdown declared on a hand that ended by a fold', () => {
    const { issues } = validateHand(
      withHand({
        riverActions: [
          { position: 'BB', kind: 'BET', amount: bb(30) },
          { position: 'BTN', kind: 'FOLD' },
        ],
      }),
    );
    expect(issues.some((issue) => issue.includes('ended by a fold'))).toBe(true);
  });

  it('a fold ending with no showdown passes, and hands the pot to the last player', () => {
    const hand = withHand({
      riverActions: [
        { position: 'BB', kind: 'BET', amount: bb(30) },
        { position: 'BTN', kind: 'FOLD' },
      ],
      showdown: null,
    });
    expect(validateHand(hand).issues).toEqual([]);
    const resolved = resolveStory(hand);
    expect(resolved.ending).toEqual({ kind: 'fold', winner: 'BB', folded: 'BTN', street: 'river' });
    // The fold's 30BB bet stays in the pot: 60.5 + 30.
    expect(resolved.pot).toBe(Money.fromBB(90.5));
  });

  it('a big blind who never acted in an unraised pot', () => {
    const hand = withHand({
      preflopActions: [
        { position: 'UTG', kind: 'FOLD' },
        { position: 'HJ', kind: 'FOLD' },
        { position: 'CO', kind: 'FOLD' },
        { position: 'BTN', kind: 'CALL' },
        { position: 'SB', kind: 'FOLD' },
      ],
    });
    const { issues } = validateHand(hand);
    expect(issues.some((issue) => issue.includes('BB had the option'))).toBe(true);
  });

  it('a wrong hand-story record type', () => {
    const { issues } = validateStory({ ...FIXTURE_STORY, contentType: 'search-guide' });
    expect(issues[0]).toContain('not "hand-story"');
    const { hand: _hand, ...noHand } = FIXTURE_STORY;
    expect(validateStory(noHand).issues.some((issue) => issue.includes('needs a `hand`'))).toBe(
      true,
    );
  });
});

describe('storyMdxIssues — refuses', () => {
  it('a missing street section', () => {
    const source = FIXTURE_STORY_MDX.replace(
      /<StreetSection street="turn">[\s\S]*?<\/StreetSection>/u,
      '',
    );
    expect(
      storyMdxIssues(source, HAND).some((issue) => issue.startsWith('expected <StreetSection>')),
    ).toBe(true);
  });

  it('a street section that restates the data', () => {
    const source = FIXTURE_STORY_MDX.replace(
      '<StreetSection street="flop">',
      '<StreetSection street="flop" board={{ flop: "2s 2h 7d" }}>',
    );
    expect(storyMdxIssues(source, HAND).some((issue) => issue.includes('sets board='))).toBe(true);
  });

  it('a story without the two editorial sections', () => {
    const source = FIXTURE_STORY_MDX.replace('## 무엇을 배울 수 있나', '## 정리').replace(
      'title="흥미로운 지점"',
      'title="메모"',
    );
    const issues = storyMdxIssues(source, HAND);
    expect(issues).toHaveLength(2);
  });
});

describe('bb()', () => {
  it('is exact integer milliBB and refuses what milliBB cannot hold', () => {
    expect(bb(2.5)).toBe(2500);
    expect(() => bb(0.0005)).toThrow();
  });
});
