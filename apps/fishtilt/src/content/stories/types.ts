/**
 * The hand-story data model (D-S3-20, contract AM).
 *
 * A hand story is a blog record (`HandStoryRecord` in `../types.ts`) whose `hand` field
 * holds the reconstructed hand as DATA: seats, stacks, hole cards, the board street by
 * street, every action with its amount. The story template draws the boards, the action
 * timelines, the pots and the showdown from this record — the prose never restates a card,
 * a pot or a winner, so a typo in the MDX cannot contradict the evaluator.
 *
 * ## Money
 *
 * Every amount is integer milliBB (`MilliBB` from `@gto-self/shared`, 1 BB = 1000). Authors
 * write `bb(2.5)`; the `'exact'` rounding mode throws on anything a milliBB cannot represent
 * (`bb(0.0005)`), so a story cannot smuggle in a fraction. Pots are never authored: they are
 * SUMMED from the actions by `resolve.ts`, so "the pot does not add up" is impossible to
 * publish — the validator would have to be wrong about integer addition.
 *
 * ## What an author writes, and what is computed
 *
 * Written: positions, stacks, hole cards, board cards, actions (kind + "to" amount), the
 * declared `winner`, the narrative (in MDX). Computed and shown: pots per street, blinds,
 * the best five cards for each player, the Korean hand reading, the winner. The declared
 * `winner` is not displayed — it exists so that `validate.ts` can refuse a story whose cards
 * do not produce the ending the author thinks they do.
 */
import { Money, type MilliBB } from '@gto-self/shared';
import type { StrategyPosition } from '@gto-self/strategy-core';

/**
 * The one sentence every story shows (AGENT_COMMON_RULES rule 5). A record field rather
 * than a template constant so the disclosure is part of the DATA a validator checks, and
 * so a future second edition (another locale) carries its own sentence with its record;
 * the validator refuses any other value today.
 */
export const HAND_STORY_DISCLOSURE = '학습과 재미를 위해 재구성한 핸드 시나리오입니다.';

/** The short badge shown beside the disclosure sentence. */
export const HAND_STORY_DISCLOSURE_BADGE = '재구성한 시나리오';

/** `bb(2.5)` → 2500 milliBB. Throws for a value milliBB cannot hold exactly. */
export function bb(bigBlinds: number): MilliBB {
  return Money.fromBB(bigBlinds, 'exact');
}

/** The blinds every story is played at, in milliBB. Amounts are in BB, so these are fixed. */
export const STORY_SMALL_BLIND: MilliBB = Money.fromBB(0.5, 'exact');
export const STORY_BIG_BLIND: MilliBB = Money.ONE_BB;

/** The only variant supported today. A union so a second one is a type change, not a string. */
export type StoryGameType = 'NLHE';

/** 6-max only — `StrategyPosition` is the 6-max seat set, and `PositionDiagram` is 6-max. */
export type StoryTableSize = 6;

export const STORY_ACTION_KINDS = ['FOLD', 'CHECK', 'CALL', 'BET', 'RAISE', 'ALL_IN'] as const;

export type StoryActionKind = (typeof STORY_ACTION_KINDS)[number];

/**
 * One action. `amount` is the actor's TOTAL wager on this street after the action — "raise
 * to 9BB" is `{ kind: 'RAISE', amount: bb(9) }`, the way a dealer announces it and the way
 * a hand history records it. Required for `BET`, `RAISE` and `ALL_IN`; optional for `CALL`
 * (it is the street's current wager, and if written it must equal it); forbidden for
 * `FOLD` and `CHECK`.
 */
export interface StoryAction {
  readonly position: StrategyPosition;
  readonly kind: StoryActionKind;
  readonly amount?: MilliBB;
  /** One short remark rendered beside the action: "오픈", "3벳", "하프팟". */
  readonly note?: string;
}

/**
 * The declared showdown. `villainHand` is what the villain turns over; `winner` is the
 * author's claim, which `validate.ts` checks against `strategy-core`'s evaluator and the
 * template never prints — the printed result is the computed one.
 *
 * `null` when the hand ends without a showdown (someone folds): the validator then requires
 * the last action to be a `FOLD` that leaves exactly one player.
 */
export interface StoryShowdown {
  /** Two cards, `"7c 2c"`. */
  readonly villainHand: string;
  readonly winner: 'hero' | 'villain' | 'split';
}

export interface HandStoryHand {
  /** A display label for the game the story is set in: `"온라인 6인 캐시 게임"`. */
  readonly stakes: string;
  readonly gameType: StoryGameType;
  readonly tableSize: StoryTableSize;
  /** The shorter of the two stacks at the start of the hand, in milliBB. */
  readonly effectiveStack: MilliBB;
  readonly heroPosition: StrategyPosition;
  readonly villainPosition: StrategyPosition;
  /** Two cards, `"Qs Qh"`. */
  readonly heroHand: string;
  /**
   * Preflop actions in order. Positions that never appear are treated as having folded
   * before acting (the template says so in one line). Blinds are NOT actions — they are
   * posted by the model from `heroPosition`/`villainPosition`'s table.
   */
  readonly preflopActions: readonly StoryAction[];
  /** Three cards, `"2s 2h 7d"`. Absent when the hand ended preflop. */
  readonly flop?: string;
  readonly flopActions?: readonly StoryAction[];
  /** One card. Requires `flop`. */
  readonly turn?: string;
  readonly turnActions?: readonly StoryAction[];
  /** One card. Requires `turn`. */
  readonly river?: string;
  readonly riverActions?: readonly StoryAction[];
  readonly showdown: StoryShowdown | null;
  /** Must equal `HAND_STORY_DISCLOSURE`. */
  readonly disclosure: string;
}
