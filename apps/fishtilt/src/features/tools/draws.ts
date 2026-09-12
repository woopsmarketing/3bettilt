/**
 * The draws a beginner actually holds, and how many outs each one has — DERIVED, not typed.
 *
 * ## Why not just write "플러시 드로우: 9"
 *
 * Because 9 is not a fact about poker, it is a fact about a 52-card deck that anyone can
 * check: a suit has `RANKS.length` cards, a flush draw means four of them are already
 * visible (two in hand, two on the board), so nine are left. Every count below is computed
 * from `RANKS`/`SUITS` in `@gto-self/shared` and every one ships with the sentence that
 * derives it, because the point of this tool is that the reader ends up able to count outs
 * WITHOUT it (CLAUDE.md rules 2 and 5 — a number on screen has to come from somewhere).
 *
 * ## Where this arithmetic really belongs
 *
 * In `learn-core`, beside `outs.ts`. It is pure card combinatorics with no UI in it. It
 * lives here because `packages/` is outside this work package's file boundary; see the
 * WP-F1 report for the hand-off note.
 *
 * ## The two combined draws
 *
 * A combined draw is not a sum, because the same physical card can complete both halves.
 * The flush-plus-gutshot draw double-counts exactly one card (the gutshot rank in the flush
 * suit) and the flush-plus-open-ender double-counts exactly two (one per straight rank), so
 * each subtracts its own overlap explicitly rather than adding and hoping. Both derivations
 * are shown to the reader for the same reason.
 */
import { RANKS, SUITS } from '@gto-self/shared';

/** 4 — one card per suit. */
const CARDS_PER_RANK = SUITS.length;
/** 13 — one card per rank. */
const CARDS_PER_SUIT = RANKS.length;

/** Two in hand plus two on the board is what makes a four-card flush a DRAW. */
const SUITED_CARDS_SEEN_ON_A_FLUSH_DRAW = 4;
/** Hero holds two of the four cards of their own pocket pair's rank. */
const OWN_PAIR_CARDS_IN_HAND = 2;
/** An open-ended straight draw completes on either of two ranks; a gutshot on one. */
const OPEN_ENDED_COMPLETING_RANKS = 2;
const GUTSHOT_COMPLETING_RANKS = 1;
/** Two unpaired overcards, each of which can pair. */
const OVERCARDS_IN_HAND = 2;

const SET_OUTS = CARDS_PER_RANK - OWN_PAIR_CARDS_IN_HAND;
const GUTSHOT_OUTS = GUTSHOT_COMPLETING_RANKS * CARDS_PER_RANK;
const OVERCARD_OUTS = OVERCARDS_IN_HAND * (CARDS_PER_RANK - 1);
const OPEN_ENDED_OUTS = OPEN_ENDED_COMPLETING_RANKS * CARDS_PER_RANK;
const FLUSH_DRAW_OUTS = CARDS_PER_SUIT - SUITED_CARDS_SEEN_ON_A_FLUSH_DRAW;
/** One straight card is already inside the flush count — the gutshot rank in the flush suit. */
const FLUSH_PLUS_GUTSHOT_OVERLAP = GUTSHOT_COMPLETING_RANKS;
const FLUSH_PLUS_GUTSHOT_OUTS = FLUSH_DRAW_OUTS + GUTSHOT_OUTS - FLUSH_PLUS_GUTSHOT_OVERLAP;
/** Both straight ranks appear once each in the flush suit, so two cards are counted twice. */
const FLUSH_PLUS_OPEN_ENDED_OVERLAP = OPEN_ENDED_COMPLETING_RANKS;
const FLUSH_PLUS_OPEN_ENDED_OUTS =
  FLUSH_DRAW_OUTS + OPEN_ENDED_OUTS - FLUSH_PLUS_OPEN_ENDED_OVERLAP;

export interface DrawPreset {
  readonly id: string;
  /** Korean name first, the international term in parentheses where one is standard. */
  readonly label: string;
  readonly outs: number;
  /** The sentence that gets the reader to this number without this tool. */
  readonly derivation: string;
}

/**
 * The common draws, fewest outs first. Not a ranking and not advice — just the handful of
 * situations a beginner meets in their first sessions, so the calculator opens on something
 * real instead of an empty field.
 */
export const DRAW_PRESETS: readonly DrawPreset[] = [
  {
    id: 'set',
    label: '포켓 페어에서 셋 만들기',
    outs: SET_OUTS,
    derivation: `같은 숫자는 ${CARDS_PER_RANK}장인데 내가 이미 ${OWN_PAIR_CARDS_IN_HAND}장을 들고 있으니 ${SET_OUTS}장이 남습니다.`,
  },
  {
    id: 'gutshot',
    label: '거트샷 스트레이트 드로우 (Gutshot)',
    outs: GUTSHOT_OUTS,
    derivation: `스트레이트를 완성하는 숫자가 ${GUTSHOT_COMPLETING_RANKS}개, 그 숫자의 무늬가 ${CARDS_PER_RANK}개니까 ${GUTSHOT_OUTS}장입니다.`,
  },
  {
    id: 'overcards',
    label: '오버카드 두 장',
    outs: OVERCARD_OUTS,
    derivation: `내 손패 ${OVERCARDS_IN_HAND}장이 각각 같은 숫자 ${CARDS_PER_RANK - 1}장씩 남아 있으니 ${OVERCARD_OUTS}장입니다.`,
  },
  {
    id: 'openEnded',
    label: '양차 스트레이트 드로우 (Open-ended)',
    outs: OPEN_ENDED_OUTS,
    derivation: `양쪽 ${OPEN_ENDED_COMPLETING_RANKS}개 숫자가 스트레이트를 완성하고 각각 무늬가 ${CARDS_PER_RANK}개니까 ${OPEN_ENDED_OUTS}장입니다.`,
  },
  {
    id: 'flushDraw',
    label: '플러시 드로우',
    outs: FLUSH_DRAW_OUTS,
    derivation: `한 무늬는 ${CARDS_PER_SUIT}장인데 내 손 2장과 보드 2장, 모두 ${SUITED_CARDS_SEEN_ON_A_FLUSH_DRAW}장을 이미 봤으니 ${FLUSH_DRAW_OUTS}장이 남습니다.`,
  },
  {
    id: 'flushPlusGutshot',
    label: '플러시 드로우 + 거트샷',
    outs: FLUSH_PLUS_GUTSHOT_OUTS,
    derivation: `플러시 ${FLUSH_DRAW_OUTS}장 + 거트샷 ${GUTSHOT_OUTS}장에서, 두 번 센 카드 ${FLUSH_PLUS_GUTSHOT_OVERLAP}장(그 숫자의 플러시 무늬)을 빼면 ${FLUSH_PLUS_GUTSHOT_OUTS}장입니다.`,
  },
  {
    id: 'flushPlusOpenEnded',
    label: '플러시 드로우 + 양차',
    outs: FLUSH_PLUS_OPEN_ENDED_OUTS,
    derivation: `플러시 ${FLUSH_DRAW_OUTS}장 + 양차 ${OPEN_ENDED_OUTS}장에서, 두 번 센 카드 ${FLUSH_PLUS_OPEN_ENDED_OVERLAP}장을 빼면 ${FLUSH_PLUS_OPEN_ENDED_OUTS}장입니다.`,
  },
];

/** The preset whose out count matches exactly, or `undefined`. Used to light up a button. */
export function drawPresetWithOuts(outs: number): DrawPreset | undefined {
  return DRAW_PRESETS.find((preset) => preset.outs === outs);
}
