/**
 * The outs calculator's view model — the exact answer and the mental shortcut, arranged
 * side by side.
 *
 * `outsOdds` already returns both halves and the signed error between them; this module
 * does not recompute any of it. What it does is decide HOW MANY comparisons a street has
 * and what each one is called, which is a presentation question the domain correctly
 * refuses to answer:
 *
 *   - On the FLOP there are two genuinely different horizons — the turn alone (x2) and the
 *     turn plus the river (x4) — so two comparisons are shown.
 *   - On the TURN there is one card left, so "the next card" and "by the river" are the
 *     SAME event. `outs.ts` returns the identical float for both fields for exactly this
 *     reason. Rendering it twice under two headings would invent a distinction the deck
 *     does not have, so the turn shows ONE comparison.
 *
 * ## Why the direction is derived from the rounded value
 *
 * The error is displayed to one decimal place. If the sentence beside it were decided from
 * the raw float, a difference of 0.0004 would print "0.0%p" under the words "규칙이 실제보다
 * 높게 잡습니다" — digits and words disagreeing about the same fact. `signOfPercentagePoints`
 * rounds first, so what a reader sees and what they are told are the same claim.
 */
import {
  UNSEEN_AFTER_FLOP,
  UNSEEN_AFTER_TURN,
  type DrawStreet,
  type OutsOdds,
} from '@gto-self/learn-core';
import { signOfPercentagePoints } from './format.js';

/** 47 after the flop, 46 after the turn — read from `learn-core`, never restated here. */
export function unseenCardsOn(street: DrawStreet): number {
  return street === 'FLOP' ? UNSEEN_AFTER_FLOP : UNSEEN_AFTER_TURN;
}

export type ShortcutId = 'NEXT_CARD' | 'BY_RIVER';

/** Which way the shortcut is wrong, in words, so the gap is never signalled by colour alone. */
export type ShortcutDirection = 'OVER' | 'UNDER' | 'SAME';

export interface ShortcutComparison {
  readonly id: ShortcutId;
  /** What this horizon is, in Korean: "다음 카드 한 장 (턴)", "리버까지 두 장", "리버 한 장". */
  readonly label: string;
  /** The hypergeometric answer from `outsOdds`. */
  readonly exactProb: number;
  /** What "outs x 2" or "outs x 4" claims. */
  readonly shortcutProb: number;
  /** 2 or 4 — which multiplier this row is about. */
  readonly multiplier: number;
  /** `shortcut - exact`, signed, straight from `outsOdds`. */
  readonly error: number;
  readonly direction: ShortcutDirection;
}

function directionOf(error: number): ShortcutDirection {
  const sign = signOfPercentagePoints(error);
  if (sign > 0) return 'OVER';
  if (sign < 0) return 'UNDER';
  return 'SAME';
}

/**
 * One row per genuinely distinct horizon on this street. Two on the flop, one on the turn —
 * see the module doc for why the turn is not two identical rows.
 */
export function shortcutComparisons(odds: OutsOdds): readonly ShortcutComparison[] {
  const { ruleOfTwoAndFour: shortcut } = odds;

  const byRiver: ShortcutComparison = {
    id: 'BY_RIVER',
    label: odds.street === 'FLOP' ? '리버까지 두 장' : '리버 한 장',
    exactProb: odds.byRiverProb,
    shortcutProb: shortcut.byRiverProb,
    multiplier: shortcut.byRiverMultiplier,
    error: shortcut.byRiverError,
    direction: directionOf(shortcut.byRiverError),
  };

  if (odds.street === 'TURN') return [byRiver];

  const nextCard: ShortcutComparison = {
    id: 'NEXT_CARD',
    label: '다음 카드 한 장 (턴)',
    exactProb: odds.nextCardProb,
    shortcutProb: shortcut.nextCardProb,
    multiplier: shortcut.nextCardMultiplier,
    error: shortcut.nextCardError,
    direction: directionOf(shortcut.nextCardError),
  };

  return [nextCard, byRiver];
}
