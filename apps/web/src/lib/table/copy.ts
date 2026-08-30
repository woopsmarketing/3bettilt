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
  SeatStatus,
  Street,
  ViewPhase,
  HandView,
} from '@gto-self/poker-core';
import type { CardEntryRequest } from './cardEntry.js';

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
