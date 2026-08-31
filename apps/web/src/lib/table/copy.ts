/**
 * Korean UI copy for the practice table. Presentation only — no poker rule, no money
 * arithmetic, no engine call. Pure and React-free, so it is unit-testable and so the
 * layering intent of `CLAUDE.md` rule 4 holds here too.
 *
 * Two rules govern this file:
 *
 * 1. **Every label that comes from a domain union is an exhaustive `Record<...>` typed
 *    against that union.** A future engine addition — a new `SeatStatus`, a new
 *    `HandEventKind`, a new phase, a new `Position` — is then a COMPILE error here rather
 *    than a string that silently renders in English at the table.
 * 2. **Standard poker vocabulary stays in its international form.** `BB`, `BTN` / `SB` /
 *    `BB`, `UTG` / `HJ` / `CO`, `VPIP` / `PFR` / `3BET`, `SPR`, the hotkey letters and card
 *    ranks and suits are read by Korean players exactly as they are written; translating
 *    them would make the table harder to read, not easier. `POSITION_LABEL` is therefore an
 *    IDENTITY map — it exists purely so that a seventh position cannot appear without this
 *    file being updated.
 */
import type {
  HandEventKind,
  Position,
  SeatOccupancy,
  SeatStatus,
  Street,
  ViewPhase,
  HandView,
} from '@gto-self/poker-core';
import type {
  ConfidenceLevel,
  EnvironmentCompatibilityStatus,
  EnvironmentFactorId,
  EquityMethod,
  PostflopPotType,
  PreflopSpotUnsupportedReason,
  Provenance,
  SizingClampKind,
  StrategyErrorCode,
} from '@gto-self/strategy-core';
import type { CardEntryRequest } from './cardEntry.js';
import type { StrategySpotFamily } from './strategy.js';

/** A physical seat, as a person reads it. Seats are 1-based on screen, 0-based in code. */
export function seatLabel(seat: number): string {
  return `좌석 ${seat + 1}`;
}

/**
 * Every `SeatStatus`. `IN_HAND` is deliberately blank: "still in the hand" is the normal
 * case and a badge on every live seat is noise, not information.
 */
export const SEAT_STATUS_LABEL: Readonly<Record<SeatStatus, string>> = {
  NOT_DEALT_IN: '미참여',
  IN_HAND: '',
  FOLDED: '폴드',
  ALL_IN: '올인',
};

/**
 * Every `SeatOccupancy`, for the seat card's fallback status line — shown only while NO
 * hand is live, since a live hand's status comes from `SeatStatus` (above) instead.
 * `EMPTY` is blank: `SeatCard` already renders "빈 좌석" as the seat's name for that case,
 * and a second "empty" badge on the status line would just repeat it.
 */
export const SEAT_OCCUPANCY_LABEL: Readonly<Record<SeatOccupancy, string>> = {
  ACTIVE: '',
  SITTING_OUT: '자리 비움',
  EMPTY: '',
};

/** Whether the seat's stored occupancy is already true at the felt, or only next hand. */
export type SeatOccupancyToggleTiming = 'IN_EFFECT' | 'NEXT_HAND';

/**
 * The `S` toggle / table-side chip's own label (`SeatOccupancyToggle.tsx`), for every
 * occupancy in both timings.
 *
 * `pending` is true while the live hand's lineup DISAGREES with the seat's stored occupancy —
 * a seat toggled to SITTING_OUT that the current hand still has dealt in, and equally a seat
 * toggled back to ACTIVE that the current hand does not. The toggle flips `SeatOccupancy` at
 * the table immediately, but a live hand snapshots its own lineup and never re-reads it
 * (`tableStore.ts` — `setSeatOccupancy`), so BOTH directions are real but not yet VISIBLE at
 * the felt, and both say "다음 핸드부터". Re-activation used to claim '끔' at once, which
 * overstated exactly the way this table exists to prevent (R1 MINOR-12, `CLAUDE.md` rule 3).
 *
 * `EMPTY` never reaches the UI — the caller renders the toggle only for an occupied seat —
 * but the record is exhaustive over `SeatOccupancy`, so the compiler keeps it that way.
 */
export const SEAT_OCCUPANCY_TOGGLE_STATE: Readonly<
  Record<SeatOccupancy, Readonly<Record<SeatOccupancyToggleTiming, string>>>
> = {
  ACTIVE: { IN_EFFECT: '끔', NEXT_HAND: '다음 핸드부터' },
  SITTING_OUT: { IN_EFFECT: '켬', NEXT_HAND: '다음 핸드부터' },
  EMPTY: { IN_EFFECT: '끔', NEXT_HAND: '끔' },
};

const SEAT_OCCUPANCY_TOGGLE_TIMING: Readonly<Record<'true' | 'false', SeatOccupancyToggleTiming>> =
  {
    true: 'NEXT_HAND',
    false: 'IN_EFFECT',
  };

/** The toggle's state label. See `SEAT_OCCUPANCY_TOGGLE_STATE` for what `pending` means. */
export function seatOccupancyToggleState(occupancy: SeatOccupancy, pending: boolean): string {
  return SEAT_OCCUPANCY_TOGGLE_STATE[occupancy][SEAT_OCCUPANCY_TOGGLE_TIMING[`${pending}`]];
}

/** Every `Street`. */
export const STREET_LABEL: Readonly<Record<Street, string>> = {
  PREFLOP: '프리플랍',
  FLOP: '플랍',
  TURN: '턴',
  RIVER: '리버',
};

/** Every `ViewPhase['kind']`. `phaseLabel` adds the street and card count for a board. */
export const PHASE_LABEL: Readonly<Record<ViewPhase['kind'], string>> = {
  SETUP: '준비 중',
  AWAITING_ACTION: '액션 대기',
  AWAITING_BOARD: '보드 대기',
  AWAITING_AWARD: '정산 대기',
  COMPLETE: '완료',
};

/**
 * Every `HandEventKind`, as the verb that reads in an action row.
 *
 * `ActionRecord.kind` is typed as the whole `HandEventKind` union, so this map covers the
 * engine events too even though only a handful of them ever reach a seat footer or the
 * action log. That is the point: the union is what the type system checks.
 */
export const ACTION_LABEL: Readonly<Record<HandEventKind, string>> = {
  HAND_STARTED: '핸드 시작',
  PLAYER_DEALT_IN: '참가',
  POST_ANTE: '앤티',
  POST_DEAD_BLIND: '데드 블라인드',
  POST_SB: '스몰 블라인드',
  POST_BB: '빅 블라인드',
  HOLE_CARDS_SET: '카드 입력',
  FOLD: '폴드',
  CHECK: '체크',
  CALL: '콜',
  BET: '벳',
  RAISE: '레이즈',
  ALL_IN: '올인',
  RETURN_UNCALLED: '미콜 반환',
  FLOP_DEALT: '플랍',
  TURN_DEALT: '턴',
  RIVER_DEALT: '리버',
  POT_AWARDED: '팟 지급',
  HAND_FINISHED: '핸드 종료',
};

/**
 * Every `Position`, and every one of them maps to ITSELF. Positions are international
 * poker vocabulary and are never translated; this map exists so that a new member of the
 * union cannot slip through untouched.
 */
export const POSITION_LABEL: Readonly<Record<Position, string>> = {
  UTG: 'UTG',
  HJ: 'HJ',
  CO: 'CO',
  BTN: 'BTN',
  SB: 'SB',
  BB: 'BB',
};

/** Every `CardEntryRequest['kind']`, as the palette's own heading. */
export const CARD_ENTRY_LABEL: Readonly<Record<CardEntryRequest['kind'], string>> = {
  HERO: '내 카드',
  REVEAL: '오픈된 카드',
  BOARD: '보드',
};

/**
 * The palette's heading for one request. `label` on the request itself is English copy
 * built by `lib/table/cardEntry.ts`, which is not this pass's file; the Korean heading is
 * rebuilt HERE from the request's own structured fields (`kind`, `street`, `seat`), so no
 * logic moves and no English string is parsed.
 */
export function cardEntryHeading(request: CardEntryRequest): string {
  switch (request.kind) {
    case 'HERO':
      return CARD_ENTRY_LABEL.HERO;
    case 'REVEAL':
      return `${seatLabel(request.seat)} ${CARD_ENTRY_LABEL.REVEAL}`;
    case 'BOARD':
      return `${STREET_LABEL[request.street]} ${CARD_ENTRY_LABEL.BOARD}`;
  }
}

/**
 * The phase, as one short line. `AWAITING_BOARD` carries the street and the number of
 * cards the ENGINE says it still wants; both are field reads off the view.
 */
export function phaseLabel(view: HandView): string {
  if (view.phase.kind === 'AWAITING_BOARD') {
    return `${STREET_LABEL[view.phase.street]} 대기 (${view.phase.cardsNeeded}장)`;
  }
  return PHASE_LABEL[view.phase.kind];
}

// ---------------------------------------------------------------------------
// 기본전략 · REFERENCE — the strategy panel (`components/table/StrategyPanel.tsx`)
// ---------------------------------------------------------------------------
//
// Same two rules as everything above. Every map here is an exhaustive `Record<...>` over a
// union `@gto-self/strategy-core` owns, so a new spot family, refusal code, provenance or
// confidence level is a COMPILE error in this file rather than an English token rendered at
// the table. Action names (`FOLD`, `CALL`, `3BET`), `BB`, `SPR`, `POT` and the positions
// stay Latin (ADR-0053) and live in `lib/table/strategy.ts`, which derives them from the
// engine's own classification.
//
// The engine's user-facing name is fixed by ADR-0056 and is NOT the three letters this
// project reserves for solved output. No string in this section may ever claim otherwise,
// and no label here may call the primary action "correct" — `docs/UX.md` is explicit that
// the top action is 추천 / PRIMARY and never a verdict.

/** The engine's one user-facing name (ADR-0056). */
export const STRATEGY_ENGINE_LABEL = '기본전략 · REFERENCE';

/** The badge on the highest-frequency action. Never "정답". */
export const STRATEGY_PRIMARY_BADGE = '추천';

/** Every `Provenance` (ADR-0056) — how the number was produced, not whether it is real. */
export const PROVENANCE_LABEL: Readonly<Record<Provenance, string>> = {
  SOURCE: '표준 자료',
  DERIVED: '파생',
  HEURISTIC: '휴리스틱',
};

/** Every `ConfidenceLevel`. Postflop only; preflop provenance carries no gradation. */
export const CONFIDENCE_LABEL: Readonly<Record<ConfidenceLevel, string>> = {
  HIGH: '높음',
  MEDIUM: '보통',
  LOW: '낮음',
};

/**
 * Every spot family either policy can report, plus preflop's typed `UNSUPPORTED`. The
 * Latin short names inside the Korean labels are the standard notation a Korean player
 * reads directly (ADR-0053).
 */
export const STRATEGY_FAMILY_LABEL: Readonly<Record<StrategySpotFamily, string>> = {
  // preflop
  RFI: '오픈 (RFI)',
  VS_LIMP: '림프 상대',
  VS_OPEN: '오픈 상대',
  OPEN_PLUS_CALLER: '오픈 + 콜러',
  SQUEEZE: '스퀴즈',
  OPENER_VS_3BET: '3BET 당함',
  COLD_4BET: '콜드 4BET',
  VS_4BET: '4BET 상대',
  BLIND_VS_BLIND: '블라인드 대결',
  VS_ALLIN: '올인 상대',
  // postflop
  CBET: '연속 베팅 (C-BET)',
  DELAYED_CBET: '지연 C-BET',
  PROBE: '프로브 벳',
  FACING_BET: '벳 상대',
  FACING_RAISE: '레이즈 상대',
  FACING_ALL_IN: '올인 상대',
  // neither
  UNSUPPORTED: '모델링되지 않은 라인',
};

/** Every `PreflopSpotUnsupportedReason`. Shown verbatim beside 지원하지 않는 상황. */
export const STRATEGY_UNSUPPORTED_REASON_LABEL: Readonly<
  Record<PreflopSpotUnsupportedReason, string>
> = {
  NOT_PREFLOP: '프리플랍이 아닙니다',
  NO_ACTIVE_OPPONENT: '살아 있는 상대가 없습니다',
  HERO_IS_CURRENT_AGGRESSOR: '히어로가 현재 공격자입니다',
  CALLER_FACING_THREE_BET: '콜 이후 3BET을 맞은 라인입니다',
  COLD_FIVE_BET: '콜드 5BET 라인입니다',
  BEYOND_FOUR_BET: '4BET을 넘는 라인입니다',
};

/** Every `PostflopPotType`. */
export const POT_TYPE_LABEL: Readonly<Record<PostflopPotType, string>> = {
  LIMPED: '림프 팟',
  SINGLE_RAISED: '싱글 레이즈 팟',
  THREE_BET: '3BET 팟',
  FOUR_BET_PLUS: '4BET 이상 팟',
};

/**
 * Every `EnvironmentCompatibilityStatus`. There is deliberately no "일치" member, because
 * the package has no `EXACT` status to report: the public charts behind the reference
 * tables never state the rake or ante structure they assume (ADR-0056).
 */
export const ENVIRONMENT_STATUS_LABEL: Readonly<
  Record<EnvironmentCompatibilityStatus, string>
> = {
  APPROXIMATE: '근사',
  DIVERGENT: '차이 있음',
};

/** Every `EnvironmentFactorId`. */
export const ENVIRONMENT_FACTOR_LABEL: Readonly<Record<EnvironmentFactorId, string>> = {
  ANTE: '앤티',
  RAKE: '레이크',
  STACK_DEPTH: '스택 깊이',
  LINEUP_SIZE: '인원 수',
  GAME_FORMAT: '게임 포맷',
};

/**
 * Every `EquityMethod`. An enumerated equity and a bounded-sample estimate must not be
 * presented the same way — `equity/model.ts` says so explicitly, and this is where the
 * distinction reaches the user.
 */
export const EQUITY_METHOD_LABEL: Readonly<Record<EquityMethod, string>> = {
  EXACT: '전수 계산',
  SUBSAMPLED: '표본 추정',
};

/** Every `SizingClampKind`. `NONE` is blank: the ordinary case needs no badge. */
export const SIZING_CLAMP_LABEL: Readonly<Record<SizingClampKind, string>> = {
  NONE: '',
  RAISED_TO_MINIMUM: '최소 레이즈로 올림',
  LOWERED_TO_MAXIMUM: '최대 레이즈로 내림',
};

/**
 * Every `StrategyErrorCode`. The engine's own `code` and `message` are still rendered
 * VERBATIM beside these (`CLAUDE.md` rule 3) — this is the Korean frame around the
 * engine's verdict, never a replacement for it.
 */
export const STRATEGY_ERROR_LABEL: Readonly<Record<StrategyErrorCode, string>> = {
  HERO_UNKNOWN: '히어로 좌석이 지정되지 않았습니다.',
  HERO_NOT_DEALT_IN: '히어로가 이번 핸드에 참여하지 않았습니다.',
  HERO_NOT_ACTOR: '히어로 차례가 아닙니다.',
  NO_LEGAL_ACTIONS: '지금 가능한 액션이 없습니다.',
  NOT_A_DECISION_POINT: '지원하지 않는 상황입니다.',
  UNSUPPORTED_LINEUP: '지원하지 않는 인원 구성입니다.',
  POSITION_UNAVAILABLE: '포지션 정보를 읽을 수 없습니다.',
  UNSUPPORTED_ACTION_KIND: '지원하지 않는 액션이 기록되어 있습니다.',
  INVALID_HERO_CARDS: '내 카드를 입력하면 기본전략을 계산합니다.',
  INVALID_BOARD: '보드 카드 구성을 읽을 수 없습니다.',
  INVALID_BPS: '빈도 값을 읽을 수 없습니다.',
  INVALID_COMBO_INDEX: '핸드 조합 값을 읽을 수 없습니다.',
  INVALID_WEIGHT_LENGTH: '레인지 가중치 길이가 맞지 않습니다.',
  NORMALIZATION_UNDEFINED: '레인지를 정규화할 수 없습니다.',
  INVALID_TOTAL: '합계 값을 읽을 수 없습니다.',
  ZERO_MASS_RANGE: '계산할 레인지가 비어 있습니다.',
};

/**
 * A ratio the engine produced, as a whole percent. Equity and pot odds are floats; they
 * are rounded for DISPLAY and never re-used for arithmetic, and no decimal place is shown
 * that the model does not support (ADR-0056's "no fake solver precision").
 */
export function ratioPercentLabel(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

/** SPR is a ratio, not money, so one decimal is honest and useful. */
export function sprLabel(spr: number): string {
  return spr.toFixed(1);
}
