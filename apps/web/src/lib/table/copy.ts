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
// TYPE-ONLY, like every other domain import in this file. `import type` is erased, so this
// presentation module gains no runtime edge to the composition layer — it only borrows its
// closed vocabularies so the maps below cannot fall behind them.
import type {
  AdaptiveCapId,
  AdaptiveNote,
  AdaptiveNoteCode,
  AdaptiveReasonKey,
  AdaptiveRuleId,
  AdaptiveStatKey,
  AdaptiveStatus,
} from '@gto-self/adaptive-core';
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
import type { ExternalHudStatKey } from '@gto-self/player-core';
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

/**
 * The `S` toggle / table-side chip's own label (`SeatOccupancyToggle.tsx`), for every
 * occupancy.
 *
 * THERE IS NO LONGER A "다음 핸드부터" STATE, and the timing union that carried it is gone
 * (V2 WP-2/WP-5). Sitting a seat out is applied to the table AT ONCE; when a hand is live the
 * hand is discarded and re-dealt from the changed table at the same hand number
 * (`HAND_REBASED_NOTICE`), so there is no window in which the stored occupancy and the felt
 * disagree and therefore nothing left for a pending label to be honest about. The earlier
 * wording existed because a live hand snapshotted its lineup and never re-read it; the rebase
 * removed that gap rather than papering over it.
 *
 * `EMPTY` never reaches the UI — the caller renders the toggle only for an occupied seat —
 * but the record is exhaustive over `SeatOccupancy`, so the compiler keeps it that way.
 */
export const SEAT_OCCUPANCY_TOGGLE_STATE: Readonly<Record<SeatOccupancy, string>> = {
  ACTIVE: '끔',
  SITTING_OUT: '켬',
  EMPTY: '끔',
};

/** The toggle's state label. One argument: occupancy is always already true at the felt. */
export function seatOccupancyToggleState(occupancy: SeatOccupancy): string {
  return SEAT_OCCUPANCY_TOGGLE_STATE[occupancy];
}

// ---------------------------------------------------------------------------
// 좌석 정정 · 핸드 진행 (V2 WP-1/2/3/4/5) — `components/table/*`
// ---------------------------------------------------------------------------
//
// Written HERE, ahead of the components that render them, because this file is the only place
// in the app that authors Korean prose. Same two rules as everything above: a string that
// names a member of a closed set is an exhaustive `Record<...>` over that set.

/**
 * Shown after a CORRECTION (rebase): a seat change arrived while a hand was live, so the hand
 * was thrown away and dealt again from the corrected table at the SAME hand number.
 *
 * It says "다시 구성했습니다" and not "다음 핸드부터" because that is what happened — the
 * design contract §1.1 is explicit that a rebase never advances the hand number, never rotates
 * the button and never records a skip. Dismissable, and never a modal (`docs/UX.md`).
 */
export const HAND_REBASED_NOTICE = '좌석 변경으로 현재 핸드를 처음부터 다시 구성했습니다.';

/**
 * The same notice, plus WHERE THE BUTTON WENT when the re-deal moved it (ADR-0078c).
 *
 * ADR-0058(c) advances a button that is not dealt in, and a rebase reaches that rule mid-hand:
 * sitting the button seat out moves the button, and sitting it back in does not move it back.
 * The rule is not changed — one deal rule, not two — but silence about it is the one
 * unacceptable option, because the user would otherwise play the rebuilt hand from a button
 * they never chose and never saw move. `[이 좌석을 버튼으로]` (WP-6) is the documented way back.
 *
 * `null` — the ordinary case — renders exactly the sentence above, unchanged.
 */
export function handRebasedNotice(buttonMovedTo: number | null): string {
  if (buttonMovedTo === null) return HAND_REBASED_NOTICE;
  return `${HAND_REBASED_NOTICE} 버튼이 ${seatLabel(buttonMovedTo)}으로 이동했습니다.`;
}

/** The skip button's label (design contract §1.2). It is not "다음 핸드": actions are lost. */
export const QUICK_NEXT_HAND_LABEL = '빠른 다음 핸드';

/**
 * What 빠른 다음 핸드 actually costs, said before it is pressed rather than after.
 *
 * The second sentence is the one that matters: a skipped hand's remaining action is never
 * entered, so the stacks this app carries forward are the ones from BEFORE that action. The
 * user is the only one who can reconcile them, so they are told to.
 */
export const QUICK_NEXT_HAND_DESCRIPTION =
  '남은 액션은 기록하지 않고 다음 핸드로 이동합니다. 상대 스택은 다음 핸드 전에 확인하세요.';

/**
 * A seat whose stack this app can no longer vouch for — it was dealt in to a hand that was
 * skipped rather than played out, so its stored stack is the pre-action one.
 *
 * Two strings, and they are deliberately different: the badge is a STATE ("this number is
 * suspect"), the action is an INSTRUCTION ("type what it really is"). Neither says the number
 * is wrong, because nobody knows that — only that it was not observed.
 */
export const SEAT_DIRTY_BADGE = '확인 필요';
export const SEAT_DIRTY_ACTION_LABEL = '스택 입력';

/** Swapping the person in a seat, and adding one who is not in this session's roster yet. */
export const PLAYER_SWAP_LABEL = '플레이어 변경';
export const PLAYER_SWAP_NEW_LABEL = '새 플레이어 추가';

/**
 * Why a candidate is not selectable in 플레이어 변경.
 *
 * One person cannot hold two seats at one table, so a player already seated in this session is
 * offered but REFUSED WITH A REASON rather than silently filtered out of the list — a name the
 * user is looking for and cannot find reads as a bug, and the honest answer is short.
 */
export type PlayerSwapRejection = 'ALREADY_SEATED';

export const PLAYER_SWAP_REJECTION_LABEL: Readonly<Record<PlayerSwapRejection, string>> = {
  ALREADY_SEATED: '이미 이 세션의 다른 좌석에 앉아 있습니다.',
};

/** Correcting a seat's stack by hand. */
export const STACK_EDIT_LABEL = '스택 수정';

/**
 * The seat-correction panel (WP-6) — the small overlay that fixes one seat's stack, moves the
 * button onto it, and reaches the existing sit-out toggle from the same place.
 *
 * `SEAT_CORRECTION_LABEL` is BOTH the chip on the seat card and the panel's own heading, and
 * that is deliberate: the control and the surface it opens carry one name.
 */
export const SEAT_CORRECTION_LABEL = '정정';
export const SEAT_CORRECTION_CLOSE_LABEL = '닫기';
export const SEAT_CORRECTION_STACK_LABEL = '스택 (BB)';
export const SEAT_CORRECTION_SAVE_LABEL = '저장';

/**
 * The button control's two states. A closed set, so an exhaustive `Record` over it: the seat
 * that already holds the button STATES that fact (and the control is disabled), and every other
 * seat offers the move.
 */
export type SeatButtonSeatState = 'CURRENT' | 'MAKE';

export const SEAT_BUTTON_SEAT_LABEL: Readonly<Record<SeatButtonSeatState, string>> = {
  CURRENT: '현재 버튼 좌석',
  MAKE: '이 좌석을 버튼으로',
};

/**
 * Why a typed stack was not accepted. The entered text is NEVER discarded when one of these
 * fires (`CLAUDE.md` rule 3) — the field keeps what the user typed and this sentence sits
 * beside it.
 *
 * `NOT_A_NUMBER` and `NOT_POSITIVE` are separate because they are different mistakes: a typo
 * and a value the table cannot hold. Telling the user "0보다 커야 합니다" about `12o` would be
 * a wrong explanation of a real refusal.
 */
export type StackEditRejection = 'NOT_A_NUMBER' | 'NOT_POSITIVE';

export const STACK_EDIT_REJECTION_LABEL: Readonly<Record<StackEditRejection, string>> = {
  NOT_A_NUMBER: '숫자로 읽을 수 없는 값입니다.',
  NOT_POSITIVE: '스택은 0 BB보다 커야 합니다.',
};

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

/**
 * The label on the recommended size line, in BOTH sections.
 *
 * One string rather than two: 기본전략 and 상대 적응 answer the same question about the same
 * quantity, and giving each its own noun ("추천 사이즈" here, "추천 크기" there) would read as
 * two different measurements of two different things. The V2 design mock writes it 추천 크기;
 * the wording kept is the one already on screen and already pinned by the panel's tests.
 */
export const SIZING_RECOMMENDATION_LABEL = '추천 사이즈';

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
export const ENVIRONMENT_STATUS_LABEL: Readonly<Record<EnvironmentCompatibilityStatus, string>> = {
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

// ---------------------------------------------------------------------------
// 상대 적응 · ADAPTIVE — the composition layer (`components/table/StrategyPanel.tsx`)
// ---------------------------------------------------------------------------
//
// Same two rules as everything above, and one more that is specific to this layer.
//
// EVERY MAP HERE IS EXHAUSTIVE OVER A UNION `@gto-self/adaptive-core` OWNS. That package is
// deliberately copy-free — it ships a token, an id and the numbers behind it, and never a
// sentence — so this file is where the prose is written. A new stat, rule, reason, cap or
// note is a COMPILE error here rather than an English token rendered at the table
// (WP-J design contract §8).
//
// NOTHING HERE IS GTO (`CLAUDE.md` rule 2). ADAPTIVE is this project's own authored exploit,
// composed from a small sample by rules we wrote, and every label below has to keep reading
// that way: a rule fired, an opponent was read a certain way, and the layer moved a
// frequency. No label may claim the result is solved, correct or optimal.

/** The composition layer's one user-facing name. Never 'GTO', never '정답'. */
export const ADAPTIVE_ENGINE_LABEL = '상대 적응 · ADAPTIVE';

/**
 * A quantity that did not move. Used by `signedBpsPointsLabel` and `sizingStepLabel` below,
 * and on its own wherever a whole answer came out equal to 기본전략.
 */
export const ADAPTIVE_NO_CHANGE_LABEL = '변화 없음';

/**
 * Every `AdaptiveStatKey`. Standard HUD notation (`VPIP`, `PFR`, `3BET`, `CBET`, `WTSD`,
 * `WSD`) stays Latin exactly as `POSITION_LABEL` does (ADR-0053); the scope around it — which
 * street, which side of the bet — is the part a Korean player reads as Korean.
 */
export const ADAPTIVE_STAT_LABEL: Readonly<Record<AdaptiveStatKey, string>> = {
  VPIP: 'VPIP',
  PFR: 'PFR',
  THREE_BET: '3BET',
  FOLD_TO_THREE_BET: '3BET에 폴드',
  STEAL: '스틸 시도',
  FOLD_BB_TO_STEAL: 'BB 스틸 폴드',
  CBET_FLOP: '플랍 CBET',
  CBET_TURN: '턴 CBET',
  CBET_RIVER: '리버 CBET',
  FOLD_TO_CBET_FLOP: '플랍 CBET에 폴드',
  FOLD_TO_CBET_TURN: '턴 CBET에 폴드',
  FOLD_TO_CBET_RIVER: '리버 CBET에 폴드',
  CHECK_RAISE_FLOP: '플랍 체크레이즈',
  CHECK_RAISE_TURN: '턴 체크레이즈',
  CHECK_RAISE_RIVER: '리버 체크레이즈',
  WTSD: 'WTSD',
  WSD: 'WSD',
  // Generic, street-blind readings (WP-K) — see `ADAPTIVE_STAT_KEY` doc for why these are
  // separate from the per-street keys above.
  CBET_ANY_STREET: 'CBET (전체 스트리트)',
  FOLD_TO_CBET_ANY_STREET: 'CBET에 폴드 (전체 스트리트)',
  CHECK_RAISE_ANY_STREET: '체크레이즈 (전체 스트리트)',
};

/**
 * Every `AdaptiveReasonKey`. A reason names what was READ about the opponent, not which lever
 * moved — several rules share one reason, and the rule id is shown separately.
 *
 * "기준" everywhere below is `ADAPTIVE_PRIORS`' zero-adjustment anchor, which is this
 * project's own declared neutral point and NOT a claim about what a solver would do.
 */
export const ADAPTIVE_REASON_LABEL: Readonly<Record<AdaptiveReasonKey, string>> = {
  OPPONENT_FOLDS_TOO_MUCH: '기준보다 자주 폴드',
  OPPONENT_FOLDS_TOO_LITTLE: '기준보다 덜 폴드',
  OPPONENT_CHECK_RAISES: '기준보다 체크레이즈가 잦음',
  OPPONENT_GOES_TO_SHOWDOWN: '기준보다 쇼다운까지 자주 감',
  OPPONENT_AVOIDS_SHOWDOWN: '기준보다 쇼다운을 피함',
  OPPONENT_BETS_WIDE: '기준보다 넓은 레인지로 벳',
  OPPONENT_BETS_NARROW: '기준보다 좁은 레인지로 벳',
  OPPONENT_THREE_BETS_WIDE: '기준보다 3BET이 잦음',
  OPPONENT_FOLDS_TO_THREE_BET: '기준보다 3BET에 자주 폴드',
  OPPONENT_DEFENDS_THREE_BET: '기준보다 3BET을 잘 방어',
  OPPONENT_FOLDS_BLIND_TO_STEAL: '기준보다 BB에서 스틸에 자주 폴드',
  OPPONENT_WINS_SHOWDOWNS: '기준보다 쇼다운 승률이 높음',
};

/**
 * Every `AdaptiveRuleId` — the thirteen frequency rules and the four sizing rules.
 *
 * Each label is "what was read → what moved", because that is the whole of what a rule does.
 * The arrow direction is the rule's own `direction`/`target`, copied from the rule table; no
 * label here asserts an effect the policy does not have.
 */
export const ADAPTIVE_RULE_LABEL: Readonly<Record<AdaptiveRuleId, string>> = {
  FOLD_TO_CBET_HIGH: 'CBET 폴드 높음 → 공격 빈도 증가',
  FOLD_TO_CBET_LOW: 'CBET 폴드 낮음 → 블러프 빈도 감소',
  FOLD_TO_CBET_LOW_VALUE_UP: 'CBET 폴드 낮음 → 밸류 벳 빈도 증가',
  CHECK_RAISE_HIGH: '체크레이즈 높음 → 마진/블러프 공격 빈도 감소',
  WTSD_HIGH_BLUFF_DOWN: 'WTSD 높음 → 블러프 감소',
  WTSD_LOW_BLUFF_UP: 'WTSD 낮음 → 블러프 증가',
  WTSD_HIGH_VALUE_UP: 'WTSD 높음 → 밸류 벳 증가',
  VILLAIN_CBET_HIGH: '상대 CBET 높음 → 콜/체크 증가',
  VILLAIN_CBET_LOW: '상대 CBET 낮음 → 폴드 증가',
  THREE_BET_HIGH_TIGHTEN: '상대 3BET 높음 → 오픈 타이트하게',
  FOLD_TO_3BET_HIGH: '상대가 3BET에 잘 폴드 → 공격 빈도 증가',
  FOLD_TO_3BET_LOW: '상대가 3BET을 잘 방어 → 공격 빈도 감소',
  FOLD_BB_TO_STEAL_HIGH: 'BB 스틸 폴드 높음 → 스틸 증가',
  SIZE_STATION_VALUE_UP: '쇼다운을 자주 봄 → 밸류 사이즈 한 단계 위로',
  SIZE_STATION_VALUE_UP_FOLD: '폴드가 적음 → 밸류 사이즈 한 단계 위로',
  SIZE_FOLDY_BLUFF_DOWN: '폴드가 많음 → 블러프 사이즈 한 단계 아래로',
  SIZE_CHECK_RAISE_DOWN: '체크레이즈가 많음 → 사이즈 한 단계 아래로',
};

/**
 * Every `AdaptiveCapId`. A cap is what HELD an adjustment back, so each label names the limit
 * rather than the failure — the reasoning is still shown, and the user is told why the number
 * on screen is smaller than the read would suggest.
 */
export const ADAPTIVE_CAP_LABEL: Readonly<Record<AdaptiveCapId, string>> = {
  RULE_MAX: '규칙 상한 적용',
  TARGET_ABSENT: '옮길 액션이 없음',
  AGGRESSIVE_PLAYER_BEHIND: '뒤에 공격적인 상대가 남아 있음',
  TOTAL_SHIFT: '전체 이동 상한 적용',
  SIZING_BUCKET_DELTA: '사이즈 단계 상한 적용',
  SIZING_LADDER_END: '사이즈 단계의 끝',
};

/**
 * Every `AdaptiveStatus`. `ADAPTED` means a rule cleared its gate and its reasoning is
 * recorded — it does NOT mean the numbers moved. Whether anything moved is
 * `changedFromBaseline`, and the panel badges that flag and never this one.
 */
export const ADAPTIVE_STATUS_LABEL: Readonly<Record<AdaptiveStatus, string>> = {
  ADAPTED: '상대 반영됨',
  INSUFFICIENT_DATA: '데이터 부족',
};

/**
 * Every `AdaptiveNoteCode`, as the bare sentence. `adaptiveNoteLabel` is what the panel calls:
 * several codes carry a stable `detail` token — a gate in bps, a cap in bps, a stat key — and
 * folding it into the sentence is the difference between "표본이 부족" and the §8 wording,
 * "표본이 신뢰도 기준 25%에 못 미침".
 */
export const ADAPTIVE_NOTE_LABEL: Readonly<Record<AdaptiveNoteCode, string>> = {
  FREQUENCY_CONFIDENCE_GATE_NOT_MET: '표본이 신뢰도 기준에 못 미침',
  SIZING_CONFIDENCE_GATE_NOT_MET: '사이즈 조정 신뢰도 기준에 못 미침',
  NO_PRIMARY_OPPONENT: '기준이 될 상대를 정할 수 없음',
  NO_RULE_APPLIED_TO_SPOT: '이 상황에 적용되는 규칙이 없음',
  AGGRESSIVE_PLAYER_BEHIND: '뒤에 공격적인 상대가 남아 있음',
  TOTAL_SHIFT_CAP_APPLIED: '전체 이동 상한이 적용됨',
  SIZING_ALL_IN_NOT_MOVED: '올인 사이즈는 조정하지 않음',
  PREFLOP_SIZING_OUT_OF_SCOPE: '프리플랍 사이즈 조정은 지원 범위 밖',
  SIZING_WAGER_WINDOW_MISSING: '합법 벳 범위를 알 수 없어 사이즈를 조정하지 않음',
  SIZING_SECONDARY_SIGNAL_WITHDRAWN: '보조 지표가 뒷받침하지 않아 사이즈를 올리지 않음',
  BASELINE_HAS_NO_ACTIONS: '기준 전략에 액션이 없음',
};

/**
 * A note's whole sentence, with its `detail` token folded in where the code has one.
 *
 * The `detail` is a STABLE TOKEN, never prose (`adaptive-core/src/policy/reasons.ts`), so it is
 * interpreted here per code and never concatenated blindly. An unrecognised detail on a code
 * that does not expect one is still shown, in parentheses, rather than dropped — a caveat the
 * layer bothered to attach is not something this file may silently swallow.
 */
export function adaptiveNoteLabel(note: AdaptiveNote): string {
  const base = ADAPTIVE_NOTE_LABEL[note.code];
  const detail = note.detail;
  if (detail === null) return base;
  switch (note.code) {
    case 'FREQUENCY_CONFIDENCE_GATE_NOT_MET':
      return `표본이 신뢰도 기준 ${bpsPercentLabel(Number(detail))}에 못 미침`;
    case 'SIZING_CONFIDENCE_GATE_NOT_MET':
      return `사이즈 조정에는 신뢰도 ${bpsPercentLabel(Number(detail))} 이상이 필요`;
    case 'TOTAL_SHIFT_CAP_APPLIED':
      return `전체 이동 상한 ${bpsAmountLabel(Number(detail))} 적용됨`;
    case 'AGGRESSIVE_PLAYER_BEHIND':
      return `${base} (${ADAPTIVE_STAT_TOKEN_LABEL[detail] ?? detail})`;
    // `detail` is the suppressed rule's own id, so the sentence can name the size that did not
    // move rather than only reporting that one did not.
    case 'SIZING_SECONDARY_SIGNAL_WITHDRAWN':
      return `${base} (${ADAPTIVE_RULE_TOKEN_LABEL[detail] ?? detail})`;
    default:
      return `${base} (${detail})`;
  }
}

/**
 * Internal. `ADAPTIVE_STAT_LABEL` addressed by a plain string, for the one place a stat key
 * arrives as an `AdaptiveNote`'s untyped `detail` token. Widening rather than casting keeps
 * the map itself exhaustive over the union.
 */
const ADAPTIVE_STAT_TOKEN_LABEL: Readonly<Record<string, string | undefined>> = ADAPTIVE_STAT_LABEL;

/** The same widening for `ADAPTIVE_RULE_LABEL`, for a note whose `detail` is a rule id. */
const ADAPTIVE_RULE_TOKEN_LABEL: Readonly<Record<string, string | undefined>> = ADAPTIVE_RULE_LABEL;

/**
 * Basis points as a whole percent. Bps and CentiPercent are the same 0..10000 unit, and a
 * confidence or a frequency is shown to the same precision the engine emits — no decimal the
 * model does not support (ADR-0056).
 */
export function bpsPercentLabel(bps: number): string {
  return `${Math.round(bps / 100)}%`;
}

/**
 * `AdaptiveAction.deltaBps` as PERCENTAGE POINTS: `+4%p`, `-4%p`, and 변화 없음 at zero.
 *
 * The unit is the whole point of this being a separate function from
 * `bpsPercentLabel`. `BET 64% (+4%)` is ambiguous — 4% OF 60 is 2.4 points, not 4 — and
 * the engine's number is a difference between two frequencies, so `%p` is the only correct
 * unit for it. `%` stays on the frequencies themselves.
 *
 * ZERO IS NAMED, NOT PRINTED AS `+0%p`. A row that did not move did not move; dressing that up
 * as a signed delta invites reading it as an adaptation that happened to be small (WP-7, and
 * `AdaptiveRecommendation.changedFromBaseline`'s own doc makes the same distinction).
 */
export function signedBpsPointsLabel(bps: number): string {
  const points = Math.round(bps / 100);
  if (points === 0) return ADAPTIVE_NO_CHANGE_LABEL;
  return `${points > 0 ? '+' : ''}${points}%p`;
}

/** Basis points as themselves, grouped in thousands: `1,850bps`. */
export function bpsAmountLabel(bps: number): string {
  return `${Math.trunc(bps)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/gu, ',')}bps`;
}

/** A signed rung offset on the pot-fraction ladder: `+1 단계`, `-1 단계`, `변화 없음`. */
export function sizingStepLabel(steps: number): string {
  if (steps === 0) return `사이즈 ${ADAPTIVE_NO_CHANGE_LABEL}`;
  return `사이즈 ${steps > 0 ? '+' : ''}${steps} 단계`;
}

/* --- WP-7: the two sections are shown TOGETHER, so each has to say where it stands ------ */

/**
 * The heading over the reason list (WP-7). It is a QUESTION the user actually has, asked in
 * their words — the previous heading was the bare noun "이유", which reads as a column label
 * rather than as an offer to explain.
 */
export const ADAPTIVE_REASONS_HEADING = '왜 이렇게 바뀌었나요?';

/**
 * `status === 'INSUFFICIENT_DATA'`, in two lines and no numbers.
 *
 * WP-7 is explicit: no invented opponent statistic, no adapted frequency, no delta. There IS
 * no adaptive answer in this state — `AdaptiveRecommendation` echoes the baseline verbatim —
 * so the honest thing to render is that the baseline is the whole answer, which is what the
 * second line says.
 */
export const ADAPTIVE_NO_OPPONENT_DATA_LABEL = '상대 데이터 없음';
export const ADAPTIVE_SAME_AS_REFERENCE_LABEL = '→ 기본전략과 동일';

/** `status === 'ADAPTED'` with `changedFromBaseline === false`: a rule fired, nothing moved. */
export const ADAPTIVE_UNCHANGED_LABEL = '조정 없음';
export const ADAPTIVE_UNCHANGED_PLAIN_REASON = '조정 결과가 기본전략과 같음';

/** Who the rules were keyed to, in the ADAPTIVE section's heading: `상대: Shadow7`. */
export function adaptiveOpponentLabel(name: string): string {
  return `상대: ${name}`;
}

/**
 * The villain a single adjustment is about, when the recommendation carries no summary for
 * them at all — the generic noun, never an invented nickname or seat.
 */
export const ADAPTIVE_UNKNOWN_OPPONENT_LABEL = '상대';

/**
 * `status === 'NONE'`: there is no adaptive answer for this spot and the section says so
 * instead of rendering an empty box or, worse, an error.
 */
export const ADAPTIVE_NOT_APPLICABLE_NOTICE = `이 상황에는 상대 적응을 적용하지 않습니다 — ${STRATEGY_ENGINE_LABEL}만 표시합니다.`;

/** Why there was nothing to adapt from, listed after the two no-data lines. */
export function adaptiveStatusReasonLabel(reasons: string): string {
  return `(사유: ${reasons})`;
}

/** The REFERENCE top action, named when ADAPTIVE promoted a different one over it. */
export function adaptiveBaselinePrimaryLabel(actionName: string): string {
  return `(기본전략 ${STRATEGY_PRIMARY_BADGE}: ${actionName})`;
}

/** The delta row's own prefix: what the opponent read actually moved. */
export const ADAPTIVE_DELTA_LABEL = '상대 반영';

/**
 * A clamped sizing, with the rung the RULE asked for kept beside the one the engine's legal
 * window allowed. Neither number is dropped (`CLAUDE.md` rule 3).
 */
export function sizingClampNote(clamp: SizingClampKind, requestedAmount: string): string {
  return `${SIZING_CLAMP_LABEL[clamp]}, 규칙값 ${requestedAmount}`;
}

/** How far the whole recommendation moved, against the policy's own ceiling. */
export function adaptiveShiftLabel(shift: string, cap: string): string {
  return `전체 이동 ${shift} / 상한 ${cap}`;
}

/** Said only when that ceiling actually bound the result. */
export const ADAPTIVE_CAP_APPLIED_LABEL = '상한 적용됨';

/** One adjustment's evidence: how many observations it rests on, and how sure of them. */
export function adaptiveSampleLabel(sampleN: number, confidenceBps: number): string {
  return `(n=${sampleN}, 신뢰도 ${bpsPercentLabel(confidenceBps)})`;
}

/**
 * The ADAPTIVE section's provenance line. This layer is an authored heuristic composed from a
 * small sample; it is never solved output and never claims to be (`CLAUDE.md` rule 2).
 */
export function adaptiveProvenanceLabel(provenance: Provenance, policyVersion: string): string {
  return `근거 ${PROVENANCE_LABEL[provenance]} (${provenance}) · 정책 ${policyVersion}`;
}

/**
 * The 10 stat categories the external HUD reports (WP-K §9). `prompt` §9's own Korean text,
 * verbatim — every term a plain-language sentence, not jargon, because the user does not
 * already know HUD vocabulary. Shown in `PlayerProfilePanel`'s external-HUD section and next
 * to the matching `ADAPTIVE_REASON_LABEL`/`ADAPTIVE_STAT_LABEL` entries in the strategy
 * panel, never tooltip-only (`prompt` §9's own instruction).
 */
export type ExternalHudGlossaryKey =
  | 'VPIP'
  | 'PFR'
  | 'THREE_BET'
  | 'FOLD_TO_THREE_BET'
  | 'CBET_ANY_STREET'
  | 'FOLD_TO_CBET_ANY_STREET'
  | 'STEAL'
  | 'CHECK_RAISE_ANY_STREET'
  | 'WTSD'
  | 'WSD';

export const EXTERNAL_HUD_GLOSSARY_ORDER: readonly ExternalHudGlossaryKey[] = [
  'VPIP',
  'PFR',
  'THREE_BET',
  'FOLD_TO_THREE_BET',
  'CBET_ANY_STREET',
  'FOLD_TO_CBET_ANY_STREET',
  'STEAL',
  'CHECK_RAISE_ANY_STREET',
  'WTSD',
  'WSD',
];

export const EXTERNAL_HUD_GLOSSARY: Readonly<Record<ExternalHudGlossaryKey, string>> = {
  VPIP: '프리플랍에 자발적으로 돈을 넣은 비율',
  PFR: '프리플랍에 레이즈한 비율',
  THREE_BET: '상대 레이즈에 다시 재레이즈한 비율',
  FOLD_TO_THREE_BET: '본인이 레이즈한 뒤 3벳을 받고 폴드한 비율',
  CBET_ANY_STREET: '프리플랍 공격자가 다음 스트리트에서도 이어서 베팅한 비율',
  FOLD_TO_CBET_ANY_STREET: '상대 C-Bet을 받고 폴드한 비율',
  STEAL: '늦은 포지션에서 블라인드를 노리고 오픈한 비율',
  CHECK_RAISE_ANY_STREET: '체크한 뒤 상대 베팅에 다시 레이즈한 비율',
  WTSD: '플랍을 본 뒤 쇼다운까지 간 비율',
  WSD: '쇼다운까지 갔을 때 이긴 비율',
};

/** `EXTERNAL_HUD_GLOSSARY`'s value shown as an unknown reading: never `0%`, always this text. */
export const EXTERNAL_HUD_UNKNOWN_LABEL = '알 수 없음';

/**
 * The FIELD LABEL for each of the 10 external-HUD stats, exhaustive over
 * `ExternalHudStatKey` — the union `@gto-self/player-core` owns, so a stat added there is a
 * compile error here rather than an unlabelled input at the table.
 *
 * These are the short headings on the import form and on the profile panel's rows;
 * `EXTERNAL_HUD_GLOSSARY` above is the SENTENCE that explains each one, and the two are shown
 * together (`prompt` §9: never tooltip-only). Every label stays in the source HUD's own
 * notation — `VPIP`, `3Bet`, `Fold to CBet`, `WTSD` — because that is the text printed beside
 * the number the user is copying from, and translating it would make the two impossible to
 * line up. `Fold to CBet` and `Check/Raise` carry no street, exactly as the source reports
 * them (`externalHud.ts`, module doc point 2).
 */
export const EXTERNAL_HUD_STAT_LABEL: Readonly<Record<ExternalHudStatKey, string>> = {
  VPIP: 'VPIP',
  PFR: 'PFR',
  THREE_BET: '3Bet',
  FOLD_TO_THREE_BET: 'Fold to 3Bet',
  CBET_ANY_STREET: 'CBet',
  FOLD_TO_CBET_ANY_STREET: 'Fold to CBet',
  STEAL: 'Steal',
  CHECK_RAISE_ANY_STREET: 'Check/Raise',
  WTSD: 'WTSD',
  WSD: 'WSD',
};

/**
 * What an empty field means, said ON the form rather than discovered afterwards.
 *
 * A blank is stored as UNKNOWN — the reading is omitted from the snapshot entirely
 * (`CreateExternalHudSnapshotInput.stats`) — and is never written as `0`. Those are opposite
 * claims about a player: "we have never seen this" versus "this player never does it", and
 * the design contract's "빈 값은 행 자체를 생략한다" rule exists to keep them apart.
 */
export const EXTERNAL_HUD_EMPTY_MEANS_UNKNOWN_HINT = `비워 두면 ${EXTERNAL_HUD_UNKNOWN_LABEL}으로 저장됩니다. 0%로 저장되지 않습니다.`;

// ---------------------------------------------------------------------------
// 카드 팔레트 (WP-8) — `components/table/CardPalette.tsx`
// ---------------------------------------------------------------------------
//
// WP-8 wrote these strings inside `CardPalette.tsx` and said so in that file's own comment,
// because `copy.ts` had a concurrent writer at the time. That writer is finished, so the
// strings live here now — the palette's behaviour, sizing and test ids are untouched, and
// every string below still renders byte-identically to what the palette produced before.

/** The palette title's suffix: `내 카드 선택`, `플랍 보드 선택`, `좌석 3 오픈된 카드 선택`. */
export const CARD_ENTRY_SELECT_SUFFIX = '선택';

/** The palette's own title. `cardEntryHeading` is still the one place a heading is built. */
export function cardEntrySelectHeading(request: CardEntryRequest): string {
  return `${cardEntryHeading(request)} ${CARD_ENTRY_SELECT_SUFFIX}`;
}

/** `카드 1` / `카드 2` for HERO and REVEAL (named), `1`..`3` for BOARD (numbered). */
export function cardEntrySlotLabel(request: CardEntryRequest, index: number): string {
  return request.kind === 'BOARD' ? `${index + 1}` : `카드 ${index + 1}`;
}

/** How many cards the ENGINE still wants. Never a count this file worked out for itself. */
export function cardEntryRemainingLabel(remaining: number): string {
  return `${remaining}장 남음`;
}

/** The same fact stated by the tray's prompt before the palette is opened. */
export function cardEntryNeededLabel(count: number): string {
  return `${count}장 더 필요합니다`;
}

export const CARD_ENTRY_OPEN_LABEL = '카드 입력';

/** The palette region's accessible name: the action plus what it is asking for. */
export function cardEntryRegionLabel(request: CardEntryRequest): string {
  return `${CARD_ENTRY_OPEN_LABEL} — ${cardEntryHeading(request)}`;
}

/** Mid-entry hint: a rank is held and the palette is waiting for its suit. */
export function cardEntrySuitPromptLabel(rank: string): string {
  return `${rank}? — 수트를 누르세요 (s h d c)`;
}

/** Who owns the keyboard right now — the palette, or the action dock. */
export const CARD_ENTRY_KEYBOARD_OWNER_LABEL: Readonly<Record<'PALETTE' | 'DOCK', string>> = {
  PALETTE: '키보드: 카드 입력',
  DOCK: '키보드: 액션',
};

export const CARD_ENTRY_CLEAR_HINT = 'Esc — 지우기';

/**
 * The accessible name of a card that is ALREADY in the current selection — in the grid and on
 * its slot chip, which are the same instruction from two places.
 *
 * It names the undo, not the card, because that is what pressing it now does (WP-8: "잘못 고른
 * 카드는 쉽게 해제/교체"). `Esc — 지우기` above is the other, wider gesture: it discards the
 * whole selection, and the two are deliberately worded so they cannot be mistaken for one
 * another.
 */
export function cardEntryUnpickLabel(card: string): string {
  return `${card} 선택 해제`;
}

// ---------------------------------------------------------------------------
// 좌석 상태 저장 · 플레이어 교체 · 외부 HUD 빠른 수정 (V2 WP-2/3/5)
// ---------------------------------------------------------------------------

/**
 * A seat-state write that did not reach the database (ADR-0075).
 *
 * The second sentence is the promise the whole persistence posture rests on: the write is
 * unawaited and a failure NEVER reverts what is on screen. What the user corrected is still
 * corrected here, in this browser; it is simply not stored, and they are told so rather than
 * finding out on the next load.
 */
export function seatStateSaveFailedNotice(detail: string): string {
  return `좌석 상태가 저장되지 않았습니다 (${detail}). 화면의 값은 되돌리지 않았습니다.`;
}

export const PLAYER_SWAP_PICK_LABEL = '기존 플레이어';
export const PLAYER_SWAP_SEARCH_LABEL = '닉네임 검색';
export const PLAYER_SWAP_NO_MATCHES_LABEL = '일치하는 플레이어가 없습니다.';
export const PLAYER_SWAP_NEW_NICKNAME_LABEL = '새 닉네임';
export const PLAYER_SWAP_SUBMIT_LABEL = '적용';
export const PLAYER_SWAP_CLOSE_LABEL = '닫기';
export const PLAYER_SWAP_CURRENT_LABEL = '현재 이 좌석';
export const PLAYER_SWAP_EXTERNAL_HUD_HEADING = '외부 HUD';

/**
 * The starting stack, required only when the seat is EMPTY.
 *
 * An occupied seat's replacement never shows this field: nobody knows what the new occupant
 * has in front of them, the server refuses a stack there, and the seat becomes `확인 필요`
 * instead. An empty seat has no number to carry over at all, so the user counts it.
 */
export const PLAYER_SWAP_STACK_LABEL = '시작 스택 (BB)';
export const PLAYER_SWAP_STACK_REQUIRED_HINT =
  '빈 좌석에 앉히려면 눈으로 확인한 시작 스택이 필요합니다.';
export const PLAYER_SWAP_REPLACE_DIRTY_HINT =
  '교체된 좌석은 확인 필요로 표시됩니다. 새 플레이어의 스택을 직접 입력하세요.';

/**
 * ADR-0079. `새 플레이어 추가` under a nickname that already exists is REFUSED, and this is the
 * sentence that turns the refusal into the next thing to do.
 *
 * It is not an apology and not a dead end: the panel switches to 기존 플레이어 with the typed
 * name already in the search box, so the match is one click away. Picking them there keeps
 * their whole external-HUD profile, which is exactly what the refused path would have collapsed
 * (ADAPTIVE reads the latest snapshot WHOLE and never merges per key — ADR-0069).
 */
export const PLAYER_EXISTS_GUIDANCE =
  '이미 있는 플레이어입니다. 아래 목록에서 골라야 기존 프로필이 그대로 유지됩니다.';

/**
 * What the server actually did, said out loud (`ReplaceSeatPlayerResult.createdPlayer`).
 *
 * The caller used to ignore that flag, so "새 플레이어 추가" that silently reused somebody
 * looked identical to one that created them. Both outcomes are legitimate — the picker path
 * reuses by design — and the user is told which one happened rather than left to assume.
 */
export function playerSeatedCreatedNotice(nickname: string): string {
  return `새 플레이어 "${nickname}"를 만들어 좌석에 앉혔습니다.`;
}

export function playerSeatedExistingNotice(nickname: string): string {
  return `기존 플레이어 "${nickname}"를 좌석에 앉혔습니다. 새로 만들지 않았습니다.`;
}

/**
 * An EMPTY seat needs a counted starting stack and this app will not invent one
 * (`CLAUDE.md` rules 1 and 5). Refused HERE, in front of the write, rather than leaving a
 * missing number to be defaulted to zero further down.
 */
export const SEAT_STACK_REQUIRED_NOTICE =
  '빈 좌석에 앉히려면 시작 스택이 필요합니다. 눈으로 확인한 스택을 입력하세요.';

/**
 * The server stored the change and the in-memory table refused it.
 *
 * This is a real, reportable divergence rather than something to paper over: the store's
 * refusal is the engine's (a COMPLETE hand still waiting to be settled dealt this seat in —
 * ADR-0078), and re-writing the OLD lineup over the row the server just wrote would silently
 * undo a successful write. So nothing is overwritten, the panel stays open, and the reload
 * that would reconcile the two is named.
 *
 * It is now the FALLBACK rather than the usual path: `TableRoot` asks the store's question
 * before it calls the server, so the one reachable refusal never gets this far. This stays
 * for a divergence nobody has predicted, which is exactly when a vague message is worst.
 */
export function seatPlayerStoreRefusedNotice(code: string, message: string): string {
  return `서버에는 저장되었지만 화면의 테이블에는 적용하지 못했습니다 (${code}: ${message}). 새로고침하면 저장된 값이 반영됩니다.`;
}

/**
 * The seat swap refused BEFORE the server call, because a finished hand still owes this seat
 * a settlement (`tableStore.replaceSeatPlayer`'s own HAND_ALREADY_FINISHED guard).
 *
 * It says what to press AND what to do when that press is itself refused, because in the one
 * state that produces this — a hand where a seat busted — it is: `startHand()` answers
 * NOT_ENOUGH_PLAYERS, and the engine's own message for THIS refusal says to start the next
 * hand. Two messages pointing at each other, with the only way out named by neither. Both
 * exits below were reproduced end-to-end before they were written down.
 */
export const SEAT_SWAP_HAND_UNSETTLED_NOTICE =
  '끝난 핸드가 아직 정산되지 않아 이 좌석의 플레이어를 바꿀 수 없습니다. [핸드 시작]을 누르면 정산됩니다. ' +
  '[핸드 시작]이 인원 부족으로 거부되면, 칩이 0이 된 좌석의 [자동 리바이]를 켜거나 빈 좌석에 플레이어를 앉힌 뒤 다시 [핸드 시작]을 누르세요.';

/**
 * The way out of the settlement dead end, in the two shapes the user meets it.
 *
 * The state: a hand reached COMPLETE with a seat busted to zero, so `startHand()` cannot
 * settle it (fewer than two seats can be dealt in — NOT_ENOUGH_PLAYERS) and every seat
 * correction is refused until it settles (HAND_ALREADY_FINISHED). Each engine message names
 * the other action as the fix, and neither can succeed. The engine codes and the store are
 * both right and are left exactly as they are; what was missing was a sentence saying which
 * door is actually open.
 *
 * Only exits that were REPRODUCED are named — turning the busted seat's auto top-up on, which
 * makes `startHand()` settle and deal, or seating a player so the deal has a lineup. Nothing
 * is offered that has not been seen to work.
 *
 * `zeroStackSeats` is a plain read of the finished hand's own view, not a prediction: those
 * are the seats the engine already shows with nothing in front of them. It is omitted rather
 * than guessed at when the view has none to report.
 */
export function settlementBlockedGuidance(
  code: string,
  zeroStackSeats: readonly number[],
): string | null {
  // Appended as its own closing observation rather than spliced into a sentence: it is a
  // reading off the screen, not part of the instruction, and it is omitted entirely when the
  // view has nothing to report.
  const seats =
    zeroStackSeats.length === 0
      ? ''
      : ` 지금 칩이 0인 좌석: ${zeroStackSeats.map((seat) => seatLabel(seat)).join(', ')}.`;
  if (code === 'NOT_ENOUGH_PLAYERS') {
    return (
      '끝난 핸드를 정산하려면 다음 핸드를 딜할 좌석이 2개 이상 필요한데, 칩이 남는 좌석이 모자랍니다. ' +
      '이 상태에서는 스택 수정과 플레이어 교체가 모두 거부되므로 다음 중 하나를 먼저 하세요: ' +
      '칩이 0인 좌석의 [자동 리바이]를 켜거나, 빈 좌석에 [플레이어 변경]으로 플레이어를 앉히세요. ' +
      `그다음 [핸드 시작]을 누르면 정산되고 다음 핸드가 딜됩니다.${seats}`
    );
  }
  if (code === 'HAND_ALREADY_FINISHED') {
    return (
      '끝난 핸드가 아직 정산되지 않아 거부되었습니다. [핸드 시작]을 누르면 정산됩니다. ' +
      '[핸드 시작]까지 인원 부족으로 거부되면, 칩이 0인 좌석의 [자동 리바이]를 켜거나 ' +
      `빈 좌석에 [플레이어 변경]으로 플레이어를 앉힌 뒤 다시 [핸드 시작]을 누르세요.${seats}`
    );
  }
  return null;
}

/**
 * A `skipped_hands` audit row that did not reach the database.
 *
 * That row is the ONLY record that a hand was skipped rather than played, so its failure is
 * shown at the same volume as a failed seat-state write instead of being swallowed. It never
 * blocks anything: the skip already happened, synchronously, before this write was attempted.
 */
export function skipAuditSaveFailedNotice(handNumber: number, detail: string): string {
  return `핸드 ${handNumber} 건너뜀 기록이 저장되지 않았습니다 (${detail}). 핸드는 이미 건너뛰었습니다.`;
}

/** The 외부 HUD editor on the profile panel (WP-3). */
export const EXTERNAL_HUD_EDIT_HEADING = '외부 HUD 빠른 수정';
export const EXTERNAL_HUD_SAVE_LABEL = '외부 HUD 저장';
export const EXTERNAL_HUD_SAVING_LABEL = '저장 중…';

/**
 * Said ON the form, because the form is pre-filled and a pre-filled form looks like an edit.
 * It is not one: `EXTERNAL_HUD` snapshots are insert-only and a save APPENDS (ADR-0076).
 */
export const EXTERNAL_HUD_APPEND_ONLY_NOTICE =
  '저장하면 기존 값을 덮어쓰지 않고 새 스냅샷으로 추가됩니다. 이전 기록은 그대로 남습니다.';
export const EXTERNAL_HUD_APPENDED_NOTICE = '새 스냅샷을 추가했습니다.';
export const EXTERNAL_HUD_UNCHANGED_NOTICE =
  '입력값이 최신 스냅샷과 같아 새로 추가하지 않았습니다.';

// ---------------------------------------------------------------------------
// FAST TABLE UX V3 — headline banner, quick HUD line, Hero Fold fast-skip
// ---------------------------------------------------------------------------
//
// `STRATEGY_ENGINE_LABEL` / `ADAPTIVE_ENGINE_LABEL` above stay exactly as ADR-0056 fixed
// them — they still render, unchanged, as the two section headings. The strings below are
// NEW copy for the always-visible headline banner introduced by this pass; they never
// repeat REFERENCE/ADAPTIVE, because the banner's whole point is to be readable in under a
// second, not to restate the engine's fixed name a second time.

/** The headline banner's own heading — never "기본전략"/"상대 적응": that is the section below it. */
export const RECOMMENDATION_HEADLINE_LABEL = '지금 추천';

/** The compact comparison block's two row labels, directly under the headline banner. */
export const COMPARISON_ADAPTIVE_ROW_LABEL = '상대 맞춤 전략';
export const COMPARISON_BASELINE_ROW_LABEL = '기본전략';
export const COMPARISON_DELTA_ROW_LABEL = '변화';

/** The two collapsible tiers under the headline (`prompt` §3): reason first, raw data second. */
export const REASON_DISCLOSURE_LABEL = '추천 이유 보기';
export const TECHNICAL_DETAIL_DISCLOSURE_LABEL = '상세 데이터 보기';

/** Hero Fold 직후 빠른 다음 핸드로 유도하는 짧은 안내 (`prompt` §7). */
export const HERO_FOLDED_FAST_SKIP_HINT = '핸드 종료 — 빠른 다음 핸드로 넘기세요 (X)';

/** 좌석 플레이어 교체 패널의 빠른 통계 한 줄 입력 (`prompt` §5/§6). */
export const QUICK_HUD_LINE_LABEL = '빠른 통계 (한 줄 입력)';
export const QUICK_HUD_LINE_ORDER_HINT =
  'VPIP PFR 3Bet Fold3Bet Steal CBet FoldCBet CheckRaise WTSD WSD — 공백 또는 콤마로 구분, 모르면 -';
export const QUICK_HUD_LINE_APPLY_LABEL = '적용';

/** `parseExternalHudLine`'s own refusals — said in the field order the parser actually uses. */
export function quickHudLineCountError(expected: number, actual: number): string {
  return `${expected}개 값이 필요합니다 (입력된 값 ${actual}개). 순서: ${QUICK_HUD_LINE_ORDER_HINT}`;
}
export function quickHudLineValueError(position: number, label: string, token: string): string {
  return `${position}번째 값(${label})이 올바르지 않습니다: "${token}". 0~100 사이 숫자이거나 모르면 -를 입력하세요.`;
}
