/**
 * The worked examples under `/tools/equity` (WP-S3-14). Every percentage is the output of
 * `@gto-self/learn-core`'s `exactHeadsUpEquity` over four named cards — the same function
 * the calculator above runs in its worker — computed here on the server at render time and
 * never typed as a literal (CLAUDE.md rules 2 and 5).
 *
 * ## The semantics this page must not blur
 *
 * `ExactEquity.equity` is hero's EXPECTED SHARE OF THE POT with ties split in half
 * (`winProb + tieProb / 2`), not the proportion of runouts hero wins outright. The guide
 * shows all four columns (win / tie / lose / equity) precisely so a reader can see the
 * difference, and the tie-heavy example (the same class against itself) is chosen because
 * it is the one case where "승률" and "이길 확률" are visibly not the same number.
 *
 * ## Cost
 *
 * A preflop matchup walks `C(48,5) = 1,712,304` boards (~250ms on a laptop). The examples are
 * computed once per process, lazily, and reused by every render and every test — a page
 * render never pays for them twice, and a build pays for them once.
 */
import { exactHeadsUpEquity, type ExactEquity } from '@gto-self/learn-core';
import { parseCards, type Card } from '@gto-self/shared';

export interface EquityExampleSpec {
  readonly id: string;
  /** What the example is FOR, in the guide's voice — never a verdict. */
  readonly title: string;
  readonly hero: string;
  readonly villain: string;
  /** `''` for preflop. */
  readonly board: string;
}

export interface EquityExample extends EquityExampleSpec {
  readonly heroCards: readonly Card[];
  readonly villainCards: readonly Card[];
  readonly boardCards: readonly Card[];
  readonly result: ExactEquity;
}

function cards(text: string): Card[] {
  const parsed = parseCards(text);
  if (!parsed.ok) throw new Error(`equity guide: cannot parse "${text}": ${parsed.error}`);
  return parsed.value;
}

function compute(spec: EquityExampleSpec): EquityExample {
  const heroCards = cards(spec.hero);
  const villainCards = cards(spec.villain);
  const boardCards = spec.board === '' ? [] : cards(spec.board);
  const outcome = exactHeadsUpEquity(heroCards, villainCards, boardCards);
  if (!outcome.ok) {
    throw new Error(
      `equity guide: "${spec.hero}" vs "${spec.villain}" on "${spec.board}" is not a legal deal (${outcome.error})`,
    );
  }
  return { ...spec, heroCards, villainCards, boardCards, result: outcome.value };
}

/**
 * The matchups the guide walks through. Chosen for what each one TEACHES about reading the
 * result — a big favourite, a coin flip, a pair against two overcards, a mirror — not as a
 * claim about how any of them should be played.
 */
export const EQUITY_MATCHUP_SPECS: readonly EquityExampleSpec[] = [
  { id: 'aa-kk', title: '높은 페어 대 낮은 페어', hero: 'AsAh', villain: 'KsKh', board: '' },
  { id: 'ak-72', title: '높은 두 장 대 낮은 두 장', hero: 'AhKh', villain: '7s2d', board: '' },
  { id: 'jts-22', title: '이어진 두 장 대 낮은 페어', hero: 'JsTs', villain: '2h2d', board: '' },
  { id: 'mirror', title: '같은 핸드끼리 (무늬만 다름)', hero: 'AsKs', villain: 'AhKh', board: '' },
];

/**
 * One matchup carried across streets, so the guide can show the SAME two hands moving as
 * the board is dealt: preflop, a flop that misses hero, a flop that hits, and the turn.
 */
export const EQUITY_BOARD_SPECS: readonly EquityExampleSpec[] = [
  { id: 'board-preflop', title: '프리플랍 (보드 0장)', hero: 'AsKs', villain: 'QhQd', board: '' },
  {
    id: 'board-flop-miss',
    title: '플랍 (보드 3장) — 내 카드가 안 맞은 경우',
    hero: 'AsKs',
    villain: 'QhQd',
    board: '2h7d9c',
  },
  {
    id: 'board-flop-hit',
    title: '플랍 (보드 3장) — K가 맞은 경우',
    hero: 'AsKs',
    villain: 'QhQd',
    board: 'Kh7d2c',
  },
  {
    id: 'board-turn',
    title: '턴 (보드 4장) — K가 맞은 뒤 한 장 더',
    hero: 'AsKs',
    villain: 'QhQd',
    board: 'Kh7d2c5s',
  },
];

let matchups: readonly EquityExample[] | null = null;
let boards: readonly EquityExample[] | null = null;

/** The four matchups, computed once. */
export function equityMatchupExamples(): readonly EquityExample[] {
  matchups ??= EQUITY_MATCHUP_SPECS.map(compute);
  return matchups;
}

/** The one matchup across four boards, computed once. */
export function equityBoardExamples(): readonly EquityExample[] {
  boards ??= EQUITY_BOARD_SPECS.map(compute);
  return boards;
}

/** The example whose tie share is the largest — the one the "비김" explanation points at. */
export function equityTieExample(): EquityExample {
  const examples = equityMatchupExamples();
  const [first] = examples;
  if (first === undefined) throw new Error('equity guide has no examples');
  return examples.reduce(
    (best, example) => (example.result.tieProb > best.result.tieProb ? example : best),
    first,
  );
}
