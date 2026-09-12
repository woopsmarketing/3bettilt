/**
 * Korean copy for the calculators. Pure presentation strings — no arithmetic, no poker rule
 * decided here.
 *
 * Same discipline as `features/range/copy.ts`: every label derived from a closed domain
 * union is an exhaustive `Record<...>` typed against that union, so a new `PotOddsError` or
 * a new `AmountError` is a COMPILE error in this file rather than a silently blank message
 * in front of a beginner. The one exception is `outsErrorLabel`, which needs the street's
 * unseen-card count inside the sentence and is therefore an exhaustive `switch` closed by
 * `assertNever` — the same guarantee, expressed the only way a parameterised message can.
 *
 * The voice is the site's: say plainly what went wrong and what the reader can do about it,
 * in the second person, without blaming them and without poker jargon they have not met
 * yet. An error message is a teaching moment on a page whose whole job is teaching.
 */
import { assertNever } from '@gto-self/shared';
import {
  DRAW_STREETS,
  type DrawStreet,
  type OutsError,
  type PotOddsError,
} from '@gto-self/learn-core';
import type { AmountError, OutsInputError } from './amount.js';
import { unseenCardsOn, type ShortcutDirection } from './outsView.js';

export const AMOUNT_ERROR_LABEL: Readonly<Record<AmountError, string>> = {
  EMPTY: '금액을 입력해주세요.',
  NOT_A_NUMBER: '숫자만 입력할 수 있습니다. 예: 10 또는 2.5',
  TOO_MANY_DECIMALS: '소수점은 셋째 자리까지만 쓸 수 있습니다. 예: 2.375',
  OUT_OF_RANGE: '너무 큰 금액입니다. 조금 더 작은 값을 넣어보세요.',
};

export const OUTS_INPUT_ERROR_LABEL: Readonly<Record<OutsInputError, string>> = {
  EMPTY: '아웃 개수를 입력해주세요.',
  NOT_A_NUMBER: '숫자만 입력할 수 있습니다. 예: 9',
};

export const POT_ODDS_ERROR_LABEL: Readonly<Record<PotOddsError, string>> = {
  NEGATIVE_POT: '팟에 들어 있는 돈은 0보다 작을 수 없습니다.',
  NEGATIVE_BET: '상대가 베팅한 금액은 0보다 작을 수 없습니다.',
  NON_POSITIVE_CALL:
    '콜 금액은 0보다 커야 합니다. 낼 돈이 없다면 계산할 콜도 없습니다 — 체크하면 되는 상황입니다.',
  CALL_EXCEEDS_BET:
    '콜 금액이 상대의 베팅보다 클 수는 없습니다. 상대가 낸 만큼만 맞추면 콜이 됩니다.',
};

/** The street's own name, with the plain-Korean reminder of how many cards are left. */
export const STREET_LABEL: Readonly<Record<DrawStreet, string>> = {
  FLOP: '플랍 (카드 2장 남음)',
  TURN: '턴 (카드 1장 남음)',
};

/** How "by the river" reads on each street: two cards still to come, or one. */
export const RIVER_HORIZON_LABEL: Readonly<Record<DrawStreet, string>> = {
  FLOP: '리버까지',
  TURN: '리버에서',
};

/** Just the street, for a spot that already explains the cards to come. */
export const STREET_SHORT_LABEL: Readonly<Record<DrawStreet, string>> = {
  FLOP: '플랍',
  TURN: '턴',
};

/** The streets a draw can still be priced on, in board order. Re-exported so a page can map
 *  over them without importing two packages for one selector. */
export const OUTS_STREETS: readonly DrawStreet[] = DRAW_STREETS;

export function outsErrorLabel(error: OutsError, street: DrawStreet): string {
  switch (error) {
    case 'NON_INTEGER_OUTS':
      return '아웃 개수는 정수로 입력해주세요. 카드는 반 장이 없습니다.';
    case 'NEGATIVE_OUTS':
      return '아웃 개수는 0보다 작을 수 없습니다.';
    case 'OUTS_EXCEED_UNSEEN':
      return `${STREET_SHORT_LABEL[street]}에서 아직 보지 못한 카드는 ${unseenCardsOn(street)}장입니다. 그보다 많은 아웃은 있을 수 없습니다.`;
    default:
      return assertNever(error, '알 수 없는 아웃 오류');
  }
}

/** How the x2/x4 shortcut is wrong, in words — never signalled by colour or a sign alone. */
export const SHORTCUT_DIRECTION_LABEL: Readonly<Record<ShortcutDirection, string>> = {
  OVER: '규칙이 실제보다 높게 잡습니다',
  UNDER: '규칙이 실제보다 낮게 잡습니다',
  SAME: '규칙과 실제가 같습니다',
};
