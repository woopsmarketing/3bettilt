/**
 * Turns a `HandStoryHand` into everything the story template prints that is not prose:
 * the blinds, each street's action rows with formatted amounts, the pot after every street,
 * who is still in, and the ending — a showdown scored by `strategy-core`'s evaluator, or a
 * fold that hands the pot to the last player standing.
 *
 * Pure and deterministic. It THROWS a `StoryResolutionError` on the first thing that does
 * not add up (a check facing a bet, a call that does not match the wager, a stack that goes
 * negative, a street with actions after the hand has ended…), so a story that reaches the
 * page has been through arithmetic that cannot be wrong by construction: pots are sums of
 * integer milliBB, never a typed number. `validate.ts` catches the throw and reports it as
 * one issue among the others; the template calls this directly and lets the build fail,
 * which is the right outcome for data the tests already refused.
 *
 * Nothing here knows React, and nothing here decides what the story MEANS — no equity, no
 * advice, no "should have". It is a dealer, not a coach.
 */
import { Money, parseCards, hasDuplicates, type Card, type MilliBB } from '@gto-self/shared';
import {
  bestFiveOf,
  comboIndexOf,
  compareHands,
  handClassOfCombo,
  STRATEGY_POSITIONS,
  type HandCategory,
  type HandValue,
  type StrategyPosition,
} from '@gto-self/strategy-core';
import {
  STORY_BIG_BLIND,
  STORY_SMALL_BLIND,
  type HandStoryHand,
  type StoryAction,
  type StoryActionKind,
} from './types.js';

export class StoryResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StoryResolutionError';
  }
}

function fail(message: string): never {
  throw new StoryResolutionError(message);
}

/* ------------------------------------------------------------------------------------- */
/* Formatting                                                                              */
/* ------------------------------------------------------------------------------------- */

/** `2500` → `"2.5BB"`. Display only; the number never goes back into arithmetic. */
export function formatStoryAmount(amount: MilliBB): string {
  return `${Money.formatBB(amount, { maxDecimals: 3 })}BB`;
}

/** `"팟 18.5BB"` — the `pot` line under a street's timeline. */
export function formatStoryPot(pot: MilliBB): string {
  return `팟 ${formatStoryAmount(pot)}`;
}

export const STORY_ACTION_LABEL: Readonly<Record<StoryActionKind, string>> = {
  FOLD: '폴드',
  CHECK: '체크',
  CALL: '콜',
  BET: '벳',
  RAISE: '레이즈',
  ALL_IN: '올인',
};

export const STORY_STREETS = ['preflop', 'flop', 'turn', 'river'] as const;

export type StoryStreet = (typeof STORY_STREETS)[number];

/* ------------------------------------------------------------------------------------- */
/* Output shape                                                                            */
/* ------------------------------------------------------------------------------------- */

/** One row of a street's timeline — the `BetAction` shape `HandTimeline` renders, resolved. */
export interface StoryTimelineRow {
  readonly position: StrategyPosition;
  readonly action: string;
  readonly amount?: string;
  readonly note?: string;
  readonly hero: boolean;
  /** `true` for the two derived blind posts at the top of the preflop timeline. */
  readonly derived: boolean;
}

export interface StoryBoard {
  readonly flop?: string;
  readonly turn?: string;
  readonly river?: string;
}

export interface ResolvedStreet {
  readonly street: StoryStreet;
  /** The board AS OF this street (`turn` shows flop + turn). `undefined` preflop. */
  readonly board?: StoryBoard;
  readonly rows: readonly StoryTimelineRow[];
  readonly potAfter: MilliBB;
  /** Positions still in the hand after this street. */
  readonly active: readonly StrategyPosition[];
}

export interface ResolvedPlayerHand {
  readonly position: StrategyPosition;
  readonly cards: readonly Card[];
  readonly cardsText: string;
  readonly value: HandValue;
  readonly category: HandCategory;
  /** The five cards the evaluator picked, in dealt order. */
  readonly bestFive: readonly Card[];
}

export type StoryEnding =
  | {
      readonly kind: 'showdown';
      readonly hero: ResolvedPlayerHand;
      readonly villain: ResolvedPlayerHand;
      readonly winner: 'hero' | 'villain' | 'split';
    }
  | {
      readonly kind: 'fold';
      /** The position that took the pot without a showdown. */
      readonly winner: StrategyPosition;
      /** The position whose fold ended the hand. */
      readonly folded: StrategyPosition;
      readonly street: StoryStreet;
    };

export interface ResolvedStory {
  readonly heroCards: readonly Card[];
  /** `'QQ'`, `'AKs'` — the 169-class key of the hero's hand, computed from the cards. */
  readonly heroClassKey: string;
  readonly streets: readonly ResolvedStreet[];
  /** Positions that never acted preflop, treated as folded before acting. */
  readonly unmentioned: readonly StrategyPosition[];
  /** The final pot — what the winner takes. */
  readonly pot: MilliBB;
  readonly ending: StoryEnding;
}

/* ------------------------------------------------------------------------------------- */
/* Cards                                                                                   */
/* ------------------------------------------------------------------------------------- */

function cardsOf(label: string, text: string | undefined, count: number): readonly Card[] {
  if (text === undefined) fail(`${label}: missing`);
  const parsed = parseCards(text);
  if (!parsed.ok) fail(`${label}: ${parsed.error}`);
  if (parsed.value.length !== count) {
    fail(`${label}: expected ${count} card(s), got ${parsed.value.length}`);
  }
  return parsed.value;
}

/** Every card the story deals, in order: hero, villain (if shown), flop, turn, river. */
export function storyCards(hand: HandStoryHand): readonly Card[] {
  const cards: Card[] = [...cardsOf('heroHand', hand.heroHand, 2)];
  if (hand.showdown !== null)
    cards.push(...cardsOf('showdown.villainHand', hand.showdown.villainHand, 2));
  if (hand.flop !== undefined) cards.push(...cardsOf('flop', hand.flop, 3));
  if (hand.turn !== undefined) cards.push(...cardsOf('turn', hand.turn, 1));
  if (hand.river !== undefined) cards.push(...cardsOf('river', hand.river, 1));
  return cards;
}

/* ------------------------------------------------------------------------------------- */
/* Betting                                                                                 */
/* ------------------------------------------------------------------------------------- */

interface TableState {
  readonly folded: Set<StrategyPosition>;
  readonly allIn: Set<StrategyPosition>;
  /** Total put in across the whole hand, per position. */
  readonly totals: Map<StrategyPosition, MilliBB>;
}

function totalOf(state: TableState, position: StrategyPosition): MilliBB {
  return state.totals.get(position) ?? Money.ZERO;
}

function potOf(state: TableState): MilliBB {
  return Money.sum([...state.totals.values()]);
}

function activeOf(state: TableState): StrategyPosition[] {
  return STRATEGY_POSITIONS.filter((position) => !state.folded.has(position));
}

/** Players who can still act: in the hand and not all-in. */
function actorsOf(state: TableState): StrategyPosition[] {
  return activeOf(state).filter((position) => !state.allIn.has(position));
}

interface StreetRun {
  readonly rows: StoryTimelineRow[];
  readonly endedByFold: StrategyPosition | null;
}

function runStreet(
  hand: HandStoryHand,
  state: TableState,
  street: StoryStreet,
  actions: readonly StoryAction[],
): StreetRun {
  const contrib = new Map<StrategyPosition, MilliBB>();
  const rows: StoryTimelineRow[] = [];
  let highest: MilliBB = Money.ZERO;

  const put = (position: StrategyPosition, to: MilliBB): void => {
    const before = contrib.get(position) ?? Money.ZERO;
    if (Money.lt(to, before)) fail(`${street}: ${position} cannot reduce a wager`);
    const delta = Money.sub(to, before);
    contrib.set(position, to);
    const total = Money.add(totalOf(state, position), delta);
    if (
      (position === hand.heroPosition || position === hand.villainPosition) &&
      Money.gt(total, hand.effectiveStack)
    ) {
      fail(
        `${street}: ${position} would have put in ${formatStoryAmount(total)}, more than the effective stack ${formatStoryAmount(hand.effectiveStack)}`,
      );
    }
    state.totals.set(position, total);
  };

  if (street === 'preflop') {
    put('SB', STORY_SMALL_BLIND);
    put('BB', STORY_BIG_BLIND);
    highest = STORY_BIG_BLIND;
    rows.push(
      {
        position: 'SB',
        action: '블라인드',
        amount: formatStoryAmount(STORY_SMALL_BLIND),
        hero: hand.heroPosition === 'SB',
        derived: true,
      },
      {
        position: 'BB',
        action: '블라인드',
        amount: formatStoryAmount(STORY_BIG_BLIND),
        hero: hand.heroPosition === 'BB',
        derived: true,
      },
    );
  }

  let endedByFold: StrategyPosition | null = null;

  for (const [index, action] of actions.entries()) {
    const where = `${street} action ${index + 1} (${action.position} ${action.kind})`;
    if (endedByFold !== null) fail(`${where}: the hand already ended`);
    if (state.folded.has(action.position)) fail(`${where}: already folded`);
    if (state.allIn.has(action.position)) fail(`${where}: already all-in`);
    const mine = contrib.get(action.position) ?? Money.ZERO;

    switch (action.kind) {
      case 'FOLD':
        if (action.amount !== undefined) fail(`${where}: a fold carries no amount`);
        state.folded.add(action.position);
        break;
      case 'CHECK':
        if (action.amount !== undefined) fail(`${where}: a check carries no amount`);
        if (!Money.eq(mine, highest)) {
          fail(`${where}: cannot check facing ${formatStoryAmount(highest)}`);
        }
        break;
      case 'CALL':
        if (Money.eq(mine, highest)) fail(`${where}: nothing to call — use CHECK`);
        if (action.amount !== undefined && !Money.eq(action.amount, highest)) {
          fail(
            `${where}: a call is ${formatStoryAmount(highest)}, not ${formatStoryAmount(action.amount)}`,
          );
        }
        put(action.position, highest);
        break;
      case 'BET':
        if (!Money.isZero(highest)) fail(`${where}: there is already a wager — use RAISE`);
        if (action.amount === undefined || !Money.isPositive(action.amount)) {
          fail(`${where}: a bet needs a positive amount`);
        }
        put(action.position, action.amount);
        highest = action.amount;
        break;
      case 'RAISE':
        if (Money.isZero(highest)) fail(`${where}: nothing to raise — use BET`);
        if (action.amount === undefined || !Money.gt(action.amount, highest)) {
          fail(`${where}: a raise must exceed ${formatStoryAmount(highest)}`);
        }
        put(action.position, action.amount);
        highest = action.amount;
        break;
      case 'ALL_IN': {
        if (action.amount === undefined || !Money.gt(action.amount, mine)) {
          fail(`${where}: an all-in needs an amount above what is already in`);
        }
        put(action.position, action.amount);
        if (
          (action.position === hand.heroPosition || action.position === hand.villainPosition) &&
          !Money.eq(totalOf(state, action.position), hand.effectiveStack)
        ) {
          fail(`${where}: an all-in must commit the whole effective stack`);
        }
        if (Money.gt(action.amount, highest)) highest = action.amount;
        state.allIn.add(action.position);
        break;
      }
      default:
        fail(`${where}: unknown action kind`);
    }

    const row: StoryTimelineRow = {
      position: action.position,
      action: STORY_ACTION_LABEL[action.kind],
      hero: action.position === hand.heroPosition,
      derived: false,
      ...(action.kind === 'FOLD' || action.kind === 'CHECK'
        ? {}
        : { amount: formatStoryAmount(contrib.get(action.position) ?? Money.ZERO) }),
      ...(action.note === undefined ? {} : { note: action.note }),
    };
    rows.push(row);

    if (activeOf(state).length === 1) endedByFold = action.position;
  }

  if (street === 'preflop') {
    // A position that never acted is treated as folded before acting — except the big
    // blind with an unraised pot, who had a free option nobody recorded.
    for (const position of STRATEGY_POSITIONS) {
      const acted = actions.some((action) => action.position === position);
      if (acted || state.folded.has(position)) continue;
      if (position === 'BB' && Money.eq(highest, STORY_BIG_BLIND) && activeOf(state).length > 1) {
        fail('preflop: nobody raised, so BB had the option — record BB CHECK or RAISE');
      }
      state.folded.add(position);
    }
    if (endedByFold === null && activeOf(state).length === 1) {
      endedByFold = actions.at(-1)?.position ?? null;
    }
  }

  if (endedByFold === null) {
    for (const position of actorsOf(state)) {
      const mine = contrib.get(position) ?? Money.ZERO;
      if (!Money.eq(mine, highest)) {
        fail(
          `${street}: not closed — ${position} has ${formatStoryAmount(mine)} in against ${formatStoryAmount(highest)}`,
        );
      }
    }
  }

  return { rows, endedByFold };
}

/* ------------------------------------------------------------------------------------- */
/* Resolution                                                                              */
/* ------------------------------------------------------------------------------------- */

const CATEGORY_KOREAN: Readonly<Record<HandCategory, string>> = {
  HIGH_CARD: '하이카드',
  PAIR: '원페어',
  TWO_PAIR: '투페어',
  TRIPS: '트리플',
  STRAIGHT: '스트레이트',
  FLUSH: '플러시',
  FULL_HOUSE: '풀하우스',
  QUADS: '포카드',
  STRAIGHT_FLUSH: '스트레이트 플러시',
};

/** The Korean category name for a resolved hand — the nine loanwords the site already uses. */
export function storyCategoryLabel(category: HandCategory): string {
  return CATEGORY_KOREAN[category];
}

function playerHand(
  position: StrategyPosition,
  cards: readonly Card[],
  cardsText: string,
  board: readonly Card[],
): ResolvedPlayerHand {
  const best = bestFiveOf([...cards, ...board]);
  return {
    position,
    cards,
    cardsText,
    value: best.value,
    category: best.value.category,
    bestFive: best.cards,
  };
}

export function resolveStory(hand: HandStoryHand): ResolvedStory {
  if (hand.heroPosition === hand.villainPosition) fail('hero and villain share a position');
  if (!Money.isPositive(hand.effectiveStack)) fail('effectiveStack must be positive');

  const heroCards = cardsOf('heroHand', hand.heroHand, 2);
  const all = storyCards(hand);
  if (hasDuplicates(all)) fail('the same card is dealt twice');
  const [heroA, heroB] = heroCards;
  if (heroA === undefined || heroB === undefined) fail('heroHand: two cards required');
  const heroClassKey = handClassOfCombo(comboIndexOf(heroA, heroB)).key;

  const state: TableState = { folded: new Set(), allIn: new Set(), totals: new Map() };
  const streets: ResolvedStreet[] = [];
  let ending: StoryEnding | null = null;

  const boardCards: Card[] = [];
  const boardText: { flop?: string; turn?: string; river?: string } = {};

  for (const street of STORY_STREETS) {
    const cardsText =
      street === 'preflop'
        ? undefined
        : street === 'flop'
          ? hand.flop
          : street === 'turn'
            ? hand.turn
            : hand.river;
    const actions =
      street === 'preflop'
        ? hand.preflopActions
        : street === 'flop'
          ? hand.flopActions
          : street === 'turn'
            ? hand.turnActions
            : hand.riverActions;

    if (ending !== null) {
      if (cardsText !== undefined)
        fail(`${street}: the hand ended earlier, but a ${street} card is given`);
      if (actions !== undefined && actions.length > 0)
        fail(`${street}: the hand ended earlier, but ${street} actions are given`);
      continue;
    }

    if (street !== 'preflop') {
      if (cardsText === undefined) {
        fail(
          `${street}: ${activeOf(state).length} players are still in, but no ${street} card is given`,
        );
      }
      const count = street === 'flop' ? 3 : 1;
      boardCards.push(...cardsOf(street, cardsText, count));
      boardText[street] = cardsText;
    }

    const canAct = actorsOf(state).length >= 2;
    const streetActions = actions ?? [];
    if (!canAct && streetActions.length > 0) {
      fail(`${street}: fewer than two players can act, but actions are given`);
    }
    if (canAct && streetActions.length === 0) {
      fail(`${street}: ${actorsOf(state).length} players can act, but no actions are given`);
    }

    const run = runStreet(hand, state, street, streetActions);
    streets.push({
      street,
      ...(street === 'preflop' ? {} : { board: { ...boardText } }),
      rows: run.rows,
      potAfter: potOf(state),
      active: activeOf(state),
    });

    if (run.endedByFold !== null) {
      const winner = activeOf(state)[0];
      if (winner === undefined) fail(`${street}: everyone folded`);
      ending = { kind: 'fold', winner, folded: run.endedByFold, street };
    }
  }

  const pot = potOf(state);

  if (ending !== null) {
    if (hand.showdown !== null) {
      fail(`the hand ended by a fold on the ${ending.street}, but a showdown is declared`);
    }
    return { heroCards, heroClassKey, streets, unmentioned: unmentionedOf(hand), pot, ending };
  }

  // Reached the river with two or more players in: a showdown.
  if (hand.showdown === null) fail('the hand reaches a showdown, but `showdown` is null');
  const active = activeOf(state);
  const expected = [hand.heroPosition, hand.villainPosition];
  if (active.length !== 2 || !expected.every((position) => active.includes(position))) {
    fail(
      `a showdown must be heads-up between hero (${hand.heroPosition}) and villain (${hand.villainPosition}); still in: ${active.join(', ')}`,
    );
  }
  if (boardCards.length !== 5) fail(`a showdown needs a five-card board, got ${boardCards.length}`);

  const villainCards = cardsOf('showdown.villainHand', hand.showdown.villainHand, 2);
  const hero = playerHand(hand.heroPosition, heroCards, hand.heroHand, boardCards);
  const villain = playerHand(
    hand.villainPosition,
    villainCards,
    hand.showdown.villainHand,
    boardCards,
  );
  const order = compareHands(hero.value.strength, villain.value.strength);
  const winner = order > 0 ? 'hero' : order < 0 ? 'villain' : 'split';

  return {
    heroCards,
    heroClassKey,
    streets,
    unmentioned: unmentionedOf(hand),
    pot,
    ending: { kind: 'showdown', hero, villain, winner },
  };
}

function unmentionedOf(hand: HandStoryHand): readonly StrategyPosition[] {
  return STRATEGY_POSITIONS.filter(
    (position) => !hand.preflopActions.some((action) => action.position === position),
  );
}
