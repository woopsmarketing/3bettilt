/**
 * Every number an article is allowed to state, and where it comes from.
 *
 * ## The rule this file implements
 *
 * A figure typed into prose is a figure nobody can check. Once fifteen lessons and twenty
 * blog answers exist, "1,326가지" written by hand in eleven of them is eleven chances for one
 * of them to be wrong, stale, or quietly invented because the sentence needed a number —
 * which is precisely CLAUDE.md rule 2 and build spec §46. So MDX never writes a number. It
 * writes `<Fact name="COMBO_COUNT" />`, and this module answers, by computing from
 * `@gto-self/strategy-core` and `@gto-self/learn-core`.
 *
 * ## Provenance
 *
 * Every fact below is category **A — MATHEMATICAL FACT** or a direct read of category **B —
 * SOURCED STRATEGY**, per `docs/reports/POKER_EDUCATIONAL_DATA_AUDIT.md` §1:
 *
 * - the 1326 combos, the 169 classes, the 13/78/78 split, the 6/4/12 combo counts, a class's
 *   share of the deal, the nine 5-card hand categories, `HAND_ONE_IN_N`'s "dealt one time in
 *   N" and `CATEGORY_FREQUENCY`'s "occurs N times in `C(52,5)`" are all properties of a
 *   52-card deck. Nothing to cite.
 * - `RFI_*` reads `strategy-core`'s `RFI_RANGES` through this app's own range facade, which
 *   is the one place allowed to answer a range query. Those tables are category B, traced
 *   to `docs/reports/STRATEGY_ANCHORS.md`, and are shown under the fixed label
 *   `학습용 기본 레인지` with their conditions visible (6인 · 100BB · 아무도 참여하지
 *   않았을 때). A `Fact` never re-describes or re-derives them.
 * - `HAND_RANK` / `HAND_AT_RANK` / `HAND_EQUITY_VS_RANDOM` / `HAND_TOP_SHARE` read the frozen,
 *   EXHAUSTIVE strength dataset (`learn-core`'s `strength/`, `docs/reports/
 *   FISHTILT_WP_R_STRENGTH_DATASET.md`). `HAND_EQUITY_VS_RANDOM` states ONE narrow measured
 *   quantity — a class's all-in preflop equity against a uniformly random legal opponent hand
 *   — and nothing wider. It is not, and must never be phrased as, how well a hand PLAYS: that
 *   is playability, which this dataset explicitly is not (see `strength/model.ts`'s header),
 *   and stating it that way would smuggle a recommendation into what is supposed to be a
 *   measured number.
 * - `CATEGORY_RANK` / `CATEGORY_FREQUENCY` read `learn-core`'s `categoryFrequency.ts`, a
 *   from-scratch enumeration of all `C(52,5) = 2,598,960` five-card hands, independent of the
 *   copy `strategy-core`'s own test carries the same numbers in (cross-checked in
 *   `docs/reports/WP_G3_DOMAIN_FACTS.md` §5).
 * - `CLASS_VS_CLASS_EQUITY` reads `learn-core`'s FROZEN class-vs-class dataset
 *   (`classVsClassMatchupFor`) — only the specific matchups a generator computed offline and
 *   pinned into `classVsClassDataset.generated.ts` resolve; every other pair, including any
 *   that merely looks similar, throws rather than computing live (`docs/reports/
 *   WP_G3_DOMAIN_FACTS.md` §3, §6 — one pairing is ~85ms and a real matchup is dozens to
 *   hundreds of pairings, so a page render can never call the live engine).
 * - `EXACT_EQUITY` reads `learn-core`'s `exactHeadsUpEquity` — four concrete cards (plus an
 *   optional board), walked exhaustively. It answers "these four cards", never "this class
 *   against that class"; only `CLASS_VS_CLASS_EQUITY` answers the class question, and only
 *   for the two matchups above.
 * - `OUTS_PROB` reads `learn-core`'s `outsOdds` — a closed-form hypergeometric probability,
 *   never sampled. Its `SHORTCUT_*` targets read the SAME result's `ruleOfTwoAndFour` field,
 *   so an article can state the textbook "outs x 2 / outs x 4" shortcut next to the exact
 *   number and let the reader see the gap, without ever typing either figure by hand.
 * - `POT_ODDS_REQUIRED_EQUITY` reads `learn-core`'s `potOdds`, after converting its two BB
 *   inputs to milliBB via `@gto-self/shared`'s `Money.parseBB` (CLAUDE.md rule 1 — no BB
 *   arithmetic ever happens in this file, only in `Money`/`potOdds`). It assumes hero calls
 *   the full bet (`callAmountMbb === villainBetMbb`) — the ordinary case `potOdds.ts` itself
 *   documents — because that is the only shape `docs/FISHTILT_CONTENT_PLAN.md` §2.4 asks
 *   for (pot, bet — no separate call amount for a short-stack call).
 *
 * There is deliberately NO fact that states a recommendation, a frequency of PLAY, or
 * anything from the audit's category C. If a sentence needs one of those, the sentence is
 * wrong.
 *
 * ## No silent fallback
 *
 * An unknown name, a missing argument, an argument that is not one of the 169 classes / 9
 * categories / a real card / a legal BB amount, or a class-vs-class pair outside the two
 * frozen matchups — all throw. A `Fact` that could not be computed must break the build,
 * never render a plausible number (CLAUDE.md rule 5).
 *
 * ## Multi-value args: `|`-separated, one string in, one string out
 *
 * `Fact`'s `arg` prop (`../components/Fact.tsx`) is a single optional string — that component
 * is outside this WP's file boundary and its shape is not changed here. A fact that needs
 * more than one value packs them into that one string, parts separated by `|`:
 *
 * - `CLASS_VS_CLASS_EQUITY`  `"<classAKey>|<classBKey>"`              e.g. `"QQ|AKs"`
 * - `EXACT_EQUITY`           `"<hero 2 cards>|<villain 2 cards>|<board?>"`
 *                                                                      e.g. `"AsKs|AhKh"` or
 *                                                                      `"QsQh|AsKh|2h7d9c"`
 * - `OUTS_PROB`              `"<outs>|FLOP|TURN|<target>"`, target one of
 *                            `NEXT|RIVER|SHORTCUT_NEXT|SHORTCUT_RIVER`
 *                                                                      e.g. `"9|FLOP|RIVER"`
 * - `POT_ODDS_REQUIRED_EQUITY` `"<pot BB>|<bet BB>"`                   e.g. `"3|2"`
 *
 * Each `|`-delimited card group may still use `parseCards`' own space/comma tokenization
 * (`"As Ks"`, `"As,Ks"` and `"AsKs"` all parse the same way).
 *
 * ## Rounding
 *
 * Every NEW fact that states a percentage (`HAND_EQUITY_VS_RANDOM`, `HAND_TOP_SHARE`,
 * `CLASS_VS_CLASS_EQUITY`, `EXACT_EQUITY`, `OUTS_PROB`, `POT_ODDS_REQUIRED_EQUITY`) renders
 * it the same way: `(fraction * 100).toFixed(2)` plus `%` — two decimal places, matching the
 * convention the original `HAND_SHARE` fact already established. Two decimals were chosen
 * over one because several of these datasets place classes or equities close enough together
 * that one decimal collapses a real difference (e.g. two class-vs-class equities in the
 * 53-57% neighbourhood), and over more than two because the display text — not the float
 * underneath — is the thing two articles citing the same fact must print identically.
 * `HAND_ONE_IN_N` is a count, not a percentage, and is rounded to the nearest integer
 * (`Math.round`) because deal counts do not always divide evenly (`1326 / 12 = 110.5` for a
 * 12-combo offsuit class); prose citing it should therefore say "약 N번에 한 번", never an
 * unqualified "N번에 한 번" — the Fact returns the nearest whole number, not an exact one.
 */
import {
  COMBO_COUNT,
  HAND_CATEGORIES,
  HAND_CLASSES,
  HAND_CLASS_COUNT,
  handClassByKey,
  hasHandClass,
  STRATEGY_POSITIONS,
  type HandCategory,
  type HandClassKind,
  type StrategyPosition,
} from '@gto-self/strategy-core';
import {
  categoryFrequencyOf,
  classVsClassMatchupFor,
  DRAW_STREETS,
  exactHeadsUpEquity,
  handClassFacts,
  HAND_STRENGTH_BY_RANK,
  handStrengthOf,
  outsOdds,
  potOdds,
  type DrawStreet,
} from '@gto-self/learn-core';
import { Money, parseCards, type Card, type MilliBB } from '@gto-self/shared';
import { resolveRange } from '../features/range/index.js';

export const FACT_NAMES = [
  'COMBO_COUNT',
  'HAND_CLASS_COUNT',
  'CLASSES_OF_KIND',
  'COMBOS_OF_KIND',
  'HAND_COMBOS',
  'HAND_SHARE',
  'RFI_COMBOS',
  'RFI_PERCENT',
  'RFI_POSITIONS_WITH',
  'HAND_RANK',
  'HAND_AT_RANK',
  'HAND_EQUITY_VS_RANDOM',
  'HAND_TOP_SHARE',
  'HAND_ONE_IN_N',
  'CATEGORY_RANK',
  'CATEGORY_FREQUENCY',
  'CLASS_VS_CLASS_EQUITY',
  'EXACT_EQUITY',
  'OUTS_PROB',
  'POT_ODDS_REQUIRED_EQUITY',
] as const;

export type FactName = (typeof FACT_NAMES)[number];

const KOREAN = 'ko-KR';

const HAND_CLASS_KINDS: readonly HandClassKind[] = ['PAIR', 'SUITED', 'OFFSUIT'];

/** Every `OUTS_PROB` target: the two EXACT figures `outsOdds` reports, and the two shortcut
 * figures its `ruleOfTwoAndFour` field carries alongside them. */
const OUTS_PROB_TARGETS = ['NEXT', 'RIVER', 'SHORTCUT_NEXT', 'SHORTCUT_RIVER'] as const;
type OutsProbTarget = (typeof OUTS_PROB_TARGETS)[number];

function requireArg(name: FactName, arg: string | undefined): string {
  if (arg === undefined || arg.length === 0) {
    throw new Error(`Fact "${name}" needs an arg`);
  }
  return arg;
}

function requireKind(name: FactName, arg: string | undefined): HandClassKind {
  const value = requireArg(name, arg);
  const kind = HAND_CLASS_KINDS.find((candidate) => candidate === value);
  if (kind === undefined) {
    throw new Error(`Fact "${name}" arg must be one of PAIR|SUITED|OFFSUIT, got "${value}"`);
  }
  return kind;
}

function requirePosition(name: FactName, arg: string | undefined): StrategyPosition {
  const value = requireArg(name, arg);
  const position = STRATEGY_POSITIONS.find((candidate) => candidate === value);
  if (position === undefined) {
    throw new Error(`Fact "${name}" arg must be a position, got "${value}"`);
  }
  return position;
}

function requireHandClass(name: FactName, arg: string | undefined) {
  const key = requireArg(name, arg);
  const handClass = handClassByKey(key);
  if (handClass === undefined) {
    throw new Error(`Fact "${name}" arg must be one of the 169 hand classes, got "${key}"`);
  }
  return handClass;
}

function requireHandCategory(name: FactName, arg: string | undefined): HandCategory {
  const value = requireArg(name, arg);
  const category = HAND_CATEGORIES.find((candidate) => candidate === value);
  if (category === undefined) {
    throw new Error(`Fact "${name}" arg must be one of the 9 hand categories, got "${value}"`);
  }
  return category;
}

function requireRank(name: FactName, arg: string | undefined): number {
  const value = requireArg(name, arg);
  const rank = Number(value);
  if (!Number.isInteger(rank) || rank < 1 || rank > HAND_CLASS_COUNT) {
    throw new Error(
      `Fact "${name}" arg must be an integer 1..${HAND_CLASS_COUNT}, got "${value}"`,
    );
  }
  return rank;
}

/**
 * Splits a `|`-delimited multi-value arg into `min..max` trimmed parts. See the file header's
 * "Multi-value args" section for why `|` and which facts use it.
 */
function splitArgs(name: FactName, arg: string | undefined, min: number, max: number): string[] {
  const raw = requireArg(name, arg);
  const parts = raw.split('|').map((part) => part.trim());
  if (parts.length < min || parts.length > max) {
    const range = min === max ? `${min}` : `${min}-${max}`;
    throw new Error(
      `Fact "${name}" needs ${range} '|'-separated parts, got ${parts.length} in "${raw}"`,
    );
  }
  return parts;
}

function requireCards(name: FactName, text: string, allowedCounts: readonly number[]): Card[] {
  const parsed = parseCards(text);
  if (!parsed.ok) {
    throw new Error(`Fact "${name}" could not parse "${text}" as cards: ${parsed.error}`);
  }
  if (!allowedCounts.includes(parsed.value.length)) {
    throw new Error(
      `Fact "${name}" needs ${allowedCounts.join(' or ')} cards in "${text}", got ${parsed.value.length}`,
    );
  }
  return parsed.value;
}

function requireBB(name: FactName, text: string): MilliBB {
  const parsed = Money.parseBB(text);
  if (!parsed.ok) {
    throw new Error(`Fact "${name}" could not parse "${text}" as a BB amount: ${parsed.error}`);
  }
  return parsed.value;
}

function requireOutsStreet(name: FactName, value: string): DrawStreet {
  const street = DRAW_STREETS.find((candidate) => candidate === value);
  if (street === undefined) {
    throw new Error(`Fact "${name}" street must be FLOP or TURN, got "${value}"`);
  }
  return street;
}

function requireOutsTarget(name: FactName, value: string): OutsProbTarget {
  const target = OUTS_PROB_TARGETS.find((candidate) => candidate === value);
  if (target === undefined) {
    throw new Error(
      `Fact "${name}" target must be one of ${OUTS_PROB_TARGETS.join('|')}, got "${value}"`,
    );
  }
  return target;
}

function requireOutsCount(name: FactName, value: string): number {
  const outs = Number(value);
  if (!Number.isInteger(outs) || outs < 0) {
    throw new Error(`Fact "${name}" outs must be a non-negative integer, got "${value}"`);
  }
  return outs;
}

/**
 * A probability `0..1` rendered as the two-decimal percentage every new fact in this file
 * uses. See the file header's "Rounding" section.
 */
function renderPercent(fraction: number): string {
  return `${(fraction * 100).toFixed(2)}%`;
}

/** The one shipped range query — 6-max, 100BB, first in (audit §5.4). */
function rfiResolution(position: StrategyPosition) {
  return resolveRange({ heroPosition: position, spot: 'RFI', stackDepth: 100, tableSize: 6 });
}

/**
 * Total for a legal (name, arg) pair; throws otherwise. Returns a formatted STRING because
 * that is what lands in a sentence — Korean digit grouping, one decimal place on a
 * percentage, and the same formatting everywhere the same fact appears.
 */
export function factValue(name: FactName, arg?: string): string {
  switch (name) {
    case 'COMBO_COUNT':
      return COMBO_COUNT.toLocaleString(KOREAN);

    case 'HAND_CLASS_COUNT':
      return HAND_CLASS_COUNT.toLocaleString(KOREAN);

    case 'CLASSES_OF_KIND': {
      const kind = requireKind(name, arg);
      return HAND_CLASSES.filter((handClass) => handClass.kind === kind).length.toLocaleString(
        KOREAN,
      );
    }

    case 'COMBOS_OF_KIND': {
      const kind = requireKind(name, arg);
      const example = HAND_CLASSES.find((handClass) => handClass.kind === kind);
      if (example === undefined) throw new Error(`no hand class of kind ${kind}`);
      return example.comboCount.toLocaleString(KOREAN);
    }

    case 'HAND_COMBOS':
      return handClassFacts(requireHandClass(name, arg)).comboCount.toLocaleString(KOREAN);

    case 'HAND_SHARE': {
      const facts = handClassFacts(requireHandClass(name, arg));
      return `${(facts.universeShare * 100).toFixed(2)}%`;
    }

    case 'RFI_COMBOS': {
      const resolution = rfiResolution(requirePosition(name, arg));
      if (resolution.kind !== 'RANGE') {
        throw new Error(`no shipped first-in range for ${String(arg)}`);
      }
      return resolution.comboCount.toLocaleString(KOREAN);
    }

    case 'RFI_PERCENT': {
      const resolution = rfiResolution(requirePosition(name, arg));
      if (resolution.kind !== 'RANGE') {
        throw new Error(`no shipped first-in range for ${String(arg)}`);
      }
      return `${(resolution.percentage * 100).toFixed(1)}%`;
    }

    case 'RFI_POSITIONS_WITH': {
      const handClass = requireHandClass(name, arg);
      const positions = STRATEGY_POSITIONS.filter((position) => {
        const resolution = rfiResolution(position);
        return resolution.kind === 'RANGE' && hasHandClass(resolution.range, handClass.index);
      });
      // An empty answer is a real answer — 72o is in no first-in range at all — and it has to
      // read as a sentence, not as a blank.
      return positions.length === 0 ? '한 자리도 없습니다' : positions.join(' · ');
    }

    case 'HAND_RANK':
      return handStrengthOf(requireHandClass(name, arg)).rank.toLocaleString(KOREAN);

    case 'HAND_AT_RANK': {
      const rank = requireRank(name, arg);
      const entry = HAND_STRENGTH_BY_RANK[rank - 1];
      if (entry === undefined) throw new Error(`Fact "${name}": no class at rank ${rank}`);
      return entry.key;
    }

    case 'HAND_EQUITY_VS_RANDOM':
      return renderPercent(handStrengthOf(requireHandClass(name, arg)).equity);

    case 'HAND_TOP_SHARE':
      return renderPercent(handStrengthOf(requireHandClass(name, arg)).cumulativeShare);

    case 'HAND_ONE_IN_N': {
      const facts = handClassFacts(requireHandClass(name, arg));
      return Math.round(COMBO_COUNT / facts.comboCount).toLocaleString(KOREAN);
    }

    case 'CATEGORY_RANK':
      return categoryFrequencyOf(requireHandCategory(name, arg)).rank.toLocaleString(KOREAN);

    case 'CATEGORY_FREQUENCY':
      return categoryFrequencyOf(requireHandCategory(name, arg)).count.toLocaleString(KOREAN);

    case 'CLASS_VS_CLASS_EQUITY': {
      const parts = splitArgs(name, arg, 2, 2);
      const classA = requireHandClass(name, parts[0]);
      const classB = requireHandClass(name, parts[1]);
      const resolution = classVsClassMatchupFor(classA.key, classB.key);
      if (!resolution.ok) {
        throw new Error(
          `Fact "${name}": ${classA.key} vs ${classB.key} is not one of the frozen matchups`,
        );
      }
      return renderPercent(resolution.value.equity);
    }

    case 'EXACT_EQUITY': {
      const parts = splitArgs(name, arg, 2, 3);
      const heroText = parts[0] ?? '';
      const villainText = parts[1] ?? '';
      const boardText = parts[2] ?? '';
      const hero = requireCards(name, heroText, [2]);
      const villain = requireCards(name, villainText, [2]);
      const board = requireCards(name, boardText, [0, 3, 4, 5]);
      const resolution = exactHeadsUpEquity(hero, villain, board);
      if (!resolution.ok) {
        throw new Error(
          `Fact "${name}": "${heroText}" vs "${villainText}" on "${boardText}" is not a legal deal (${resolution.error})`,
        );
      }
      return renderPercent(resolution.value.equity);
    }

    case 'OUTS_PROB': {
      const parts = splitArgs(name, arg, 3, 3);
      const outs = requireOutsCount(name, parts[0] ?? '');
      const street = requireOutsStreet(name, parts[1] ?? '');
      const target = requireOutsTarget(name, parts[2] ?? '');
      const resolution = outsOdds({ outs, street });
      if (!resolution.ok) {
        throw new Error(
          `Fact "${name}": outs=${outs} street=${street} is not a legal draw (${resolution.error})`,
        );
      }
      const odds = resolution.value;
      if (target === 'NEXT') return renderPercent(odds.nextCardProb);
      if (target === 'RIVER') return renderPercent(odds.byRiverProb);
      if (target === 'SHORTCUT_NEXT') return renderPercent(odds.ruleOfTwoAndFour.nextCardProb);
      return renderPercent(odds.ruleOfTwoAndFour.byRiverProb);
    }

    case 'POT_ODDS_REQUIRED_EQUITY': {
      const parts = splitArgs(name, arg, 2, 2);
      const potBeforeCallMbb = requireBB(name, parts[0] ?? '');
      const villainBetMbb = requireBB(name, parts[1] ?? '');
      // The ordinary case: hero calls the full bet. See the file header for why this fact
      // does not also take a separate (shorter) call amount.
      const resolution = potOdds({
        potBeforeCallMbb,
        villainBetMbb,
        callAmountMbb: villainBetMbb,
      });
      if (!resolution.ok) {
        throw new Error(
          `Fact "${name}": pot="${parts[0]}" bet="${parts[1]}" (BB) is not a legal call (${resolution.error})`,
        );
      }
      return renderPercent(resolution.value.requiredEquity);
    }

    default: {
      // Unreachable while `FactName` is exhaustive; kept so a name arriving from MDX (where
      // TypeScript cannot check the string) fails loudly instead of rendering "undefined".
      throw new Error(`unknown fact: ${String(name)}`);
    }
  }
}
