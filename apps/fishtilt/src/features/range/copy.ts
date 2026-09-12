/**
 * Korean copy for the range facade. Pure, React-free presentation strings — no poker rule,
 * no arithmetic — following the same discipline `apps/web/src/lib/table/copy.ts` documents
 * for that app: every label derived from a closed domain union is an exhaustive
 * `Record<...>` typed against that union, so a future union member (a new `RangeSpot`, a
 * new `RangeTableSize`) is a COMPILE error here rather than a silently blank label.
 *
 * `docs/reports/FISHTILT_00_AUDIT_AND_PLAN.md` §5.4/§6.3 and
 * `docs/reports/POKER_EDUCATIONAL_DATA_AUDIT.md` §6 fix the exact wording this file has to
 * reproduce: the single label `학습용 기본 레인지`, easy-Korean-first-term-second copy
 * ("앞 사람이 레이즈했을 때 (Facing Open)"), and the BB explanation
 * ("빅블라인드는 첫 번째로 오픈하는 자리가 아닙니다") rendered as a teaching moment, not an
 * error. The word "GTO" never appears anywhere in this file (CLAUDE.md rule 2).
 *
 * Standard poker notation — position abbreviations, card ranks — stays in its international
 * Latin form throughout (ADR-0053); `POSITION_LABEL` below is therefore an IDENTITY map, for
 * the same reason `apps/web`'s copy module keeps one: it exists purely so a seventh position
 * cannot appear without this file being updated, not because the abbreviation is translated.
 */
import type { Rank } from '@gto-self/shared';
import type { HandClass, StrategyPosition } from '@gto-self/strategy-core';
import type {
  RangeQuery,
  RangeSpot,
  RangeStackDepth,
  RangeTableSize,
  RangeUnsupportedReason,
} from './types.js';

/**
 * The one fixed term every range in 3BetTilt is labelled with — never varied per spot or
 * page, so a reader learns to trust exactly this phrase. `[이 기준은 무엇인가요?]` (the
 * methodology affordance this label pairs with) is a page-level concern for the WP that
 * builds the Range Explorer, not this facade.
 */
export const RANGE_LABEL = '학습용 기본 레인지';

/**
 * PROVENANCE of the shipped range, in the one place every surface reads it from.
 *
 * `packages/strategy-core/src/preflop/tables.ts` states it in its own comment: UTG / HJ / CO /
 * BTN are transcribed VERBATIM from ONE public teaching chart — "the only public source found
 * that publishes 13x13 hand-class detail for this spot", i.e. single-sourced — and only SB is
 * computed by this project (`trimSbCompositeToRaiseOnly`, because that source's SB list is a
 * raise-or-limp composite a raise-or-fold table may not use directly). The percentage bands
 * those lists land in ARE corroborated three ways, and `tables.test.ts` asserts that, so the
 * corroboration is stated — as being about the percentages, which is what it is about.
 *
 * Three surfaces used to describe this three different ways, two of them wrong: `/about` said
 * the range was NOT copied from a specific site and WAS computed here (the opposite of the
 * truth), and `/tools/range` plus every embedded matrix said "여러 무료 포커 교육 자료" —
 * a breadth of sourcing the data does not have. One constant now, so they cannot disagree
 * again and a rewording lands everywhere at once.
 *
 * The source site is deliberately NOT named here. Naming it on a public page is a product
 * decision, not a copy decision.
 */
// `RANGE_PROVENANCE_SENTENCE` is defined below `describeRangeConditions`, which it reuses.

/**
 * The 이란/란 particle for a word that is about to be DEFINED — `학습용 기본 레인지란
 * 무엇인가요?`, `팟이란 무엇인가요?`.
 *
 * Korean picks it by whether the preceding syllable carries a 받침 (final consonant): 란
 * after a bare vowel, 이란 after a consonant. `${RANGE_LABEL}이란` was hard-coded on
 * `/tools/range` and rendered `학습용 기본 레인지이란` — a grammar error in an `<h2>` on the
 * flagship page. Computing the particle from the label means the heading stays correct if the
 * label is ever reworded, which a hard-coded particle cannot promise.
 *
 * `hasBatchim` is the same technique `features/tools/handRank.ts` and
 * `features/quiz/handRankingQuestions.ts` each use privately; it is restated here rather than
 * imported for the same reason they restate it — neither exports it, and this module is
 * deliberately dependency-free presentation copy.
 */
function hasBatchim(text: string): boolean {
  const HANGUL_BASE = 0xac00;
  const HANGUL_LAST = 0xd7a3;
  const FINAL_CONSONANT_COUNT = 28;
  const last = text.codePointAt(text.length - 1);
  if (last === undefined || last < HANGUL_BASE || last > HANGUL_LAST) return false;
  return (last - HANGUL_BASE) % FINAL_CONSONANT_COUNT !== 0;
}

/** `'학습용 기본 레인지'` -> `'란'`; `'팟'` -> `'이란'`. */
export function josaIran(word: string): '이란' | '란' {
  return hasBatchim(word) ? '이란' : '란';
}

/**
 * How each rank's WRITTEN form is read aloud, for the sole purpose of picking a particle.
 *
 * `RANK_READING` stays Latin (ADR-0053), so `hasBatchim` cannot be applied to it directly —
 * `'10'` and `'A'` are not Hangul syllables. The particle a Korean writes after a token is
 * decided by how that token is READ, so this maps each rank to its standard Korean name:
 * Sino-Korean for the numerals (the convention for a particle after an Arabic numeral) and
 * the letter name for the honours. It is deliberately NOT `RANK_SPOKEN`, which is the poker
 * pronunciation gloss (`에이트`, `쓰리`) and disagrees on exactly the ranks that matter — `8`
 * is `팔` when read as a number and `에이트` when named as a card, and those take different
 * particles.
 *
 * This map exists only to answer 와/과 and should not be shown to anyone.
 */
const RANK_FOR_JOSA: Readonly<Record<Rank, string>> = {
  '2': '이',
  '3': '삼',
  '4': '사',
  '5': '오',
  '6': '육',
  '7': '칠',
  '8': '팔',
  '9': '구',
  T: '십',
  J: '제이',
  Q: '큐',
  K: '케이',
  A: '에이',
};

/**
 * `'A'` -> `'와'`; `'8'` -> `'과'`. The 와/과 counterpart of `josaIran`.
 *
 * This was a hard-coded `와` until WP-8's independent review found it, which rendered
 * `10와 9`, `8와 7`, `7와 6`, `6와 5` and `3와 2` — 48 of the 169 hand classes, on eight
 * prerendered pages plus every matrix cell and quiz explanation. `/hands/t9s` showed
 * hand-written `10과 9` and computed `10와 9` on the same screen.
 */
export function josaWaGwa(rank: Rank): '와' | '과' {
  return hasBatchim(RANK_FOR_JOSA[rank]) ? '과' : '와';
}

/** IDENTITY map — see the module doc. Positions are never translated (ADR-0053). */
export const POSITION_LABEL: Readonly<Record<StrategyPosition, string>> = {
  UTG: 'UTG',
  HJ: 'HJ',
  CO: 'CO',
  BTN: 'BTN',
  SB: 'SB',
  BB: 'BB',
};

/**
 * The Korean name each abbreviation stands for.
 *
 * This does NOT reopen ADR-0053 and does not translate anything: `POSITION_LABEL` above is
 * still the identity map, and the abbreviation is still what every control DISPLAYS. What
 * this adds is the gloss that goes *beside* it — the exact pattern §48 names as the good one
 * and that `content/learn/positions-6max.mdx` already uses in prose
 * (`<Term id="term-utg">언더더건(UTG)</Term>`). `docs/FISHTILT_STATE.md` ruling 65 recorded
 * the gap this closes: the abbreviations were correct but had no explanation anywhere near
 * the control, on the site's flagship surface and on every lesson that embeds a matrix.
 *
 * The readings are the ones the glossary entries already publish
 * (`src/content/registry/glossary/j1.ts`: `하이잭 (HJ)`, `컷오프 (CO)`, `버튼 (BTN)`,
 * `스몰 블라인드 (SB)`, `빅 블라인드 (BB)`), so a reader who follows the term through to
 * `/glossary` meets the same word. `UTG` is glossed `언더더건` rather than the glossary
 * title's descriptive `첫 번째 자리`, because that is the reading the lessons and articles
 * use in running text and the one a beginner will hear spoken at a table.
 */
export const POSITION_GLOSS: Readonly<Record<StrategyPosition, string>> = {
  UTG: '언더더건',
  HJ: '하이잭',
  CO: '컷오프',
  BTN: '버튼',
  SB: '스몰 블라인드',
  BB: '빅 블라인드',
};

/**
 * `'UTG'` -> `"언더더건(UTG) 자리"`. The ACCESSIBLE name of a position control.
 *
 * A screen reader reading the visible label alone announces `UTG` letter by letter — "유 티
 * 지" — which tells a beginner nothing at all. The visible text stays the abbreviation
 * (ADR-0053); this is what assistive technology says instead.
 */
export function positionAccessibleName(position: StrategyPosition): string {
  return `${POSITION_GLOSS[position]}(${POSITION_LABEL[position]}) 자리`;
}

/** `'UTG'` -> `"UTG 언더더건"`. One entry of the visible legend under a position group. */
export function positionLegendEntry(position: StrategyPosition): string {
  return `${POSITION_LABEL[position]} ${POSITION_GLOSS[position]}`;
}

/** Easy-Korean-first, term-second (§6.3). */
export const SPOT_LABEL: Readonly<Record<RangeSpot, string>> = {
  RFI: '아무도 참여하지 않았을 때 (First In)',
  FACING_OPEN: '앞 사람이 레이즈했을 때 (Facing Open)',
  FACING_3BET: '상대가 3벳을 했을 때 (Facing 3-Bet)',
};

export const TABLE_SIZE_LABEL: Readonly<Record<RangeTableSize, string>> = {
  2: '2인 (헤즈업)',
  6: '6인',
  9: '9인',
};

/** `100` -> `"100BB"`. `BB` is standard notation and stays Latin (ADR-0053), so this is a
 *  template, not a translated word — no exhaustive map needed for a bare number+unit. */
export function stackDepthLabel(stackDepth: RangeStackDepth): string {
  return `${stackDepth}BB`;
}

/**
 * The "conditions always visible" line the audit specifies verbatim for its own example —
 * `"6인 · 100BB · 아무도 참여하지 않았을 때"` — built here so every page renders the same
 * dot-separated order instead of each one re-composing it slightly differently.
 */
export function describeRangeConditions(query: RangeQuery): string {
  return `${TABLE_SIZE_LABEL[query.tableSize]} · ${stackDepthLabel(query.stackDepth)} · ${SPOT_LABEL[query.spot]}`;
}

/**
 * The conditions the shipped range data is for: 6-max, 100BB, first in. These are the only
 * range data this project ships, so a future dataset at another table size or stack depth
 * changes these constants together with the data, and the sentence below cannot be left
 * describing a table the site no longer shows.
 */
const SHIPPED_RANGE_TABLE_SIZE: RangeTableSize = 6;
const SHIPPED_RANGE_STACK_DEPTH: RangeStackDepth = 100;
const SHIPPED_RANGE_SPOT: RangeSpot = 'RFI';

/**
 * The site's only provenance sentence — see the block above `describeRangeConditions` for why
 * there is exactly one.
 *
 * Stage 3 (WP-S3-01a, owner-approved wording): the sentence says what the table IS — a
 * learning range for one named situation — and what it is NOT: an answer for every
 * situation. It makes no claim about other sources agreeing with it, does not describe
 * where the lists were transcribed from, and never calls the range GTO. The SB note stays
 * because it is a fact about this site's own processing: the SB list is recomputed here to
 * raise-only from a raise-or-limp composite (`trimSbCompositeToRaiseOnly`).
 *
 * The conditions are rendered through `TABLE_SIZE_LABEL`, `stackDepthLabel` and `SPOT_LABEL`
 * rather than typed as `6인 테이블·100BB·First In`: the vocabulary for these conditions is
 * owned by the formatters above, and a prose copy of it is a second spelling that goes stale
 * the first time the vocabulary changes (the defect behind P1-F7).
 */
export const RANGE_PROVENANCE_SENTENCE = `이 표는 ${TABLE_SIZE_LABEL[SHIPPED_RANGE_TABLE_SIZE]} 테이블 · ${stackDepthLabel(SHIPPED_RANGE_STACK_DEPTH)} · ${SPOT_LABEL[SHIPPED_RANGE_SPOT]} 상황을 위한 ${RANGE_LABEL}입니다. 모든 상황의 정답을 뜻하지 않으며, 게임 조건과 상대에 따라 실제 선택은 달라질 수 있습니다. SB만은 원래 목록이 레이즈와 림프를 합친 형태여서, 레이즈 부분만 남도록 이 사이트가 다시 계산했습니다.`;

/**
 * `BB_HAS_NO_RFI_RANGE` reads as an explanation, not a warning — audit §5.4: "BB is not an
 * error state". The other three keep to the same honest-empty-state voice the audit's §5.5
 * calls for: say plainly that the data is not ready, never hint at a workaround that does
 * not exist.
 */
export const UNSUPPORTED_REASON_LABEL: Readonly<Record<RangeUnsupportedReason, string>> = {
  SPOT_NOT_SHIPPED: '이 상황에 대한 학습용 기본 레인지는 아직 준비되지 않았습니다.',
  STACK_DEPTH_NOT_SHIPPED: '이 스택 깊이에 대한 학습용 기본 레인지는 아직 준비되지 않았습니다.',
  TABLE_SIZE_NOT_SHIPPED: '이 테이블 인원에 대한 학습용 기본 레인지는 아직 준비되지 않았습니다.',
  BB_HAS_NO_RFI_RANGE:
    '빅블라인드는 첫 번째로 오픈하는 자리가 아닙니다. 모두가 폴드하면 빅블라인드가 그대로 이기기 때문에, 빅블라인드가 먼저 레이즈하는 레인지는 존재하지 않습니다.',
};

/**
 * The reading used inside a Korean sentence for a card rank. Ranks stay Latin (ADR-0053) —
 * this is not a translation, it is the same "spell the ten out" step `PokerCard` already
 * takes for its own accessible name (`'T' -> '10'`), lifted into an exhaustive map here so a
 * new `Rank` is a compile error in this file too, per `apps/web/src/lib/table/copy.ts`'s
 * pattern.
 */
export const RANK_READING: Readonly<Record<Rank, string>> = {
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9',
  T: '10',
  J: 'J',
  Q: 'Q',
  K: 'K',
  A: 'A',
};

/**
 * The beginner-plain reading of a hand class, e.g. `AQs` -> `"같은 무늬의 A와 Q"` — the
 * exact example §6.3 gives. `assertNever` is not needed for exhaustiveness here (the union
 * has exactly three members and TypeScript already checks the switch is total); the
 * `default` throws only so a corrupted `kind` from outside this module cannot silently
 * return `undefined`.
 */
export function describeHandClassKorean(handClass: HandClass): string {
  const high = RANK_READING[handClass.highRank];
  const low = RANK_READING[handClass.lowRank];
  const wa = josaWaGwa(handClass.highRank);
  switch (handClass.kind) {
    case 'PAIR':
      return `같은 숫자 두 장 (${high} 페어)`;
    case 'SUITED':
      return `같은 무늬의 ${high}${wa} ${low}`;
    case 'OFFSUIT':
      return `다른 무늬의 ${high}${wa} ${low}`;
    default:
      throw new Error(`unknown hand class kind: ${String(handClass.kind)}`);
  }
}

/**
 * How a Korean player SAYS a rank out loud. Distinct from `RANK_READING`, which is the
 * written form and stays Latin.
 *
 * Build spec §10 and §21 both show a hand class with its spoken reading underneath the key
 * — `AKs · 에이스 킹 수티드` — because a beginner who has only ever seen the letters does not
 * know how to pronounce them, and cannot ask about a hand they cannot say.
 *
 * This does NOT contradict ADR-0053. That decision keeps poker NOTATION Latin, and it still
 * is: the key `AKs` is displayed unchanged. What is added beside it is a pronunciation
 * gloss, which is precisely the build spec §3 pattern of teaching the term rather than
 * hiding or replacing it. These are the readings Korean players actually use, not
 * translations of the English words.
 */
const RANK_SPOKEN: Readonly<Record<Rank, string>> = {
  '2': '투',
  '3': '쓰리',
  '4': '포',
  '5': '파이브',
  '6': '식스',
  '7': '세븐',
  '8': '에이트',
  '9': '나인',
  T: '텐',
  J: '잭',
  Q: '퀸',
  K: '킹',
  A: '에이스',
};

/** `AKs` -> `"에이스 킹 수티드"`; `AA` -> `"포켓 에이스"`; `AKo` -> `"에이스 킹 오프수트"`. */
export function handClassReading(handClass: HandClass): string {
  const high = RANK_SPOKEN[handClass.highRank];
  const low = RANK_SPOKEN[handClass.lowRank];
  switch (handClass.kind) {
    case 'PAIR':
      return `포켓 ${high}`;
    case 'SUITED':
      return `${high} ${low} 수티드`;
    case 'OFFSUIT':
      return `${high} ${low} 오프수트`;
    default:
      throw new Error(`unknown hand class kind: ${String(handClass.kind)}`);
  }
}

/**
 * `AKs` -> `"AKs 에이스 킹 수티드"`. The ACCESSIBLE name of one 13x13 matrix cell, before
 * the caller appends whatever membership state it is showing.
 *
 * The visible text of a cell is the key alone, and stays that way (ADR-0053). Announced on
 * its own, though, `AKs` is three letters read out one at a time; the reading is the part
 * that makes a cell identifiable by ear, which for a 169-button grid is the difference
 * between navigable and not. Key first so the announcement still starts with the notation
 * the reader sees.
 */
export function handClassAccessibleName(handClass: HandClass): string {
  return `${handClass.key} ${handClassReading(handClass)}`;
}

export const IN_RANGE_LABEL = '지금 보고 있는 레인지에 포함되어 있어요';
export const OUT_OF_RANGE_LABEL = '지금 보고 있는 레인지에는 포함되어 있지 않아요';
