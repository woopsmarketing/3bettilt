import { describe, expect, it } from 'vitest';
import { EXTERNAL_HUD_STAT_KEYS } from '@gto-self/player-core';
import type { CardEntryRequest } from './cardEntry.js';
import {
  ACTION_LABEL,
  ADAPTIVE_ENGINE_LABEL,
  COMPARISON_ADAPTIVE_ROW_LABEL,
  COMPARISON_BASELINE_ROW_LABEL,
  COMPARISON_DELTA_ROW_LABEL,
  HERO_FOLDED_FAST_SKIP_HINT,
  QUICK_HUD_LINE_LABEL,
  QUICK_HUD_LINE_ORDER_HINT,
  RECOMMENDATION_HEADLINE_LABEL,
  REASON_DISCLOSURE_LABEL,
  TECHNICAL_DETAIL_DISCLOSURE_LABEL,
  quickHudLineCountError,
  quickHudLineValueError,
  ADAPTIVE_NO_CHANGE_LABEL,
  ADAPTIVE_NO_OPPONENT_DATA_LABEL,
  ADAPTIVE_REASONS_HEADING,
  ADAPTIVE_SAME_AS_REFERENCE_LABEL,
  ADAPTIVE_UNCHANGED_LABEL,
  ADAPTIVE_UNCHANGED_PLAIN_REASON,
  CARD_ENTRY_LABEL,
  CONFIDENCE_LABEL,
  EXTERNAL_HUD_EMPTY_MEANS_UNKNOWN_HINT,
  EXTERNAL_HUD_GLOSSARY,
  EXTERNAL_HUD_GLOSSARY_ORDER,
  EXTERNAL_HUD_STAT_LABEL,
  EXTERNAL_HUD_UNKNOWN_LABEL,
  HAND_REBASED_NOTICE,
  PLAYER_SWAP_LABEL,
  PLAYER_SWAP_NEW_LABEL,
  PLAYER_SWAP_REJECTION_LABEL,
  QUICK_NEXT_HAND_DESCRIPTION,
  QUICK_NEXT_HAND_LABEL,
  SEAT_DIRTY_ACTION_LABEL,
  SEAT_DIRTY_BADGE,
  SIZING_RECOMMENDATION_LABEL,
  STACK_EDIT_LABEL,
  STACK_EDIT_REJECTION_LABEL,
  adaptiveOpponentLabel,
  bpsPercentLabel,
  signedBpsPointsLabel,
  sizingStepLabel,
  ENVIRONMENT_FACTOR_LABEL,
  ENVIRONMENT_STATUS_LABEL,
  EQUITY_METHOD_LABEL,
  PHASE_LABEL,
  POSITION_LABEL,
  POT_TYPE_LABEL,
  PROVENANCE_LABEL,
  SEAT_OCCUPANCY_LABEL,
  SEAT_OCCUPANCY_TOGGLE_STATE,
  SEAT_STATUS_LABEL,
  SIZING_CLAMP_LABEL,
  STRATEGY_ENGINE_LABEL,
  STRATEGY_ERROR_LABEL,
  STRATEGY_FAMILY_LABEL,
  STRATEGY_PRIMARY_BADGE,
  STRATEGY_UNSUPPORTED_REASON_LABEL,
  STREET_LABEL,
  cardEntryHeading,
  phaseLabel,
  ratioPercentLabel,
  seatLabel,
  seatOccupancyToggleState,
  sprLabel,
} from './copy.js';

/**
 * Exhaustiveness is enforced by the TYPE of each map (`Record<Union, string>`), so a new
 * engine member is a compile error, not a test failure. What these tests add is the other
 * half: that nothing in the maps is an empty stub, that the international vocabulary was
 * left alone, and that the two composed labels read correctly.
 */
describe('table copy', () => {
  it('translates every seat status except IN_HAND, which is deliberately blank', () => {
    expect(SEAT_STATUS_LABEL.IN_HAND).toBe('');
    expect(SEAT_STATUS_LABEL.FOLDED).toBe('폴드');
    expect(SEAT_STATUS_LABEL.ALL_IN).toBe('올인');
    expect(SEAT_STATUS_LABEL.NOT_DEALT_IN).toBe('미참여');
  });

  it('labels seat occupancy, blank for ACTIVE and EMPTY, Korean for SITTING_OUT', () => {
    expect(SEAT_OCCUPANCY_LABEL.ACTIVE).toBe('');
    expect(SEAT_OCCUPANCY_LABEL.EMPTY).toBe('');
    expect(SEAT_OCCUPANCY_LABEL.SITTING_OUT).toBe('자리 비움');
  });

  it('names the toggle by what it will do, with no timing qualifier', () => {
    expect(seatOccupancyToggleState('ACTIVE')).toBe('끔');
    expect(seatOccupancyToggleState('SITTING_OUT')).toBe('켬');
  });

  /**
   * V2 WP-2/WP-5 inverted R1 MINOR-12's answer rather than contradicting it. That fix said
   * "다음 핸드부터" because a live hand snapshotted its lineup and a toggle could not reach it;
   * sitting a seat out now rebases the live hand instead, so the gap the wording described no
   * longer exists and claiming it would be the overstatement.
   */
  it('no longer promises anything about a future hand', () => {
    for (const label of Object.values(SEAT_OCCUPANCY_TOGGLE_STATE)) {
      expect(label).not.toContain('다음 핸드');
    }
  });

  it('keeps a non-empty state label for every occupancy', () => {
    for (const label of Object.values(SEAT_OCCUPANCY_TOGGLE_STATE)) expect(label).not.toBe('');
  });

  it('gives every street, phase and action a non-empty Korean label', () => {
    for (const label of Object.values(STREET_LABEL)) expect(label).not.toBe('');
    for (const label of Object.values(PHASE_LABEL)) expect(label).not.toBe('');
    for (const label of Object.values(ACTION_LABEL)) expect(label).not.toBe('');
    for (const label of Object.values(CARD_ENTRY_LABEL)) expect(label).not.toBe('');
  });

  it('leaves positions in their international form', () => {
    for (const [key, label] of Object.entries(POSITION_LABEL)) expect(label).toBe(key);
  });

  it('numbers seats the way a person reads them', () => {
    expect(seatLabel(0)).toBe('좌석 1');
    expect(seatLabel(5)).toBe('좌석 6');
  });

  it('builds the palette heading from the request’s own fields', () => {
    const hero: CardEntryRequest = { kind: 'HERO', key: 'k', seat: 0, count: 2, label: 'ignored' };
    const reveal: CardEntryRequest = {
      kind: 'REVEAL',
      key: 'k',
      seat: 3,
      count: 2,
      label: 'ignored',
    };
    const board: CardEntryRequest = {
      kind: 'BOARD',
      key: 'k',
      street: 'FLOP',
      count: 3,
      label: 'ignored',
    };

    expect(cardEntryHeading(hero)).toBe('내 카드');
    expect(cardEntryHeading(reveal)).toBe('좌석 4 오픈된 카드');
    expect(cardEntryHeading(board)).toBe('플랍 보드');
  });

  it('says which street and how many cards while the engine waits for a board', () => {
    const view = {
      phase: { kind: 'AWAITING_BOARD', street: 'TURN', cardsNeeded: 1 },
    } as unknown as Parameters<typeof phaseLabel>[0];
    expect(phaseLabel(view)).toBe('턴 대기 (1장)');
  });

  it('uses the plain phase label for every other phase', () => {
    const view = { phase: { kind: 'AWAITING_AWARD', pots: [] } } as unknown as Parameters<
      typeof phaseLabel
    >[0];
    expect(phaseLabel(view)).toBe('정산 대기');
  });
});

/**
 * 기본전략 · REFERENCE. Exhaustiveness is again a TYPE property of each map; what these add
 * is that no label is a blank stub, and the two honesty rules that copy alone can break:
 * the engine is never named with the label reserved for solved output, and the primary
 * action is never called correct.
 */
describe('strategy copy', () => {
  it('gives every strategy union member a non-empty Korean label', () => {
    const maps = [
      PROVENANCE_LABEL,
      CONFIDENCE_LABEL,
      STRATEGY_FAMILY_LABEL,
      STRATEGY_UNSUPPORTED_REASON_LABEL,
      POT_TYPE_LABEL,
      ENVIRONMENT_STATUS_LABEL,
      ENVIRONMENT_FACTOR_LABEL,
      EQUITY_METHOD_LABEL,
      STRATEGY_ERROR_LABEL,
    ];
    for (const map of maps) {
      for (const label of Object.values(map)) expect(label).not.toBe('');
    }
    // The one deliberate blank: an unclamped size needs no badge.
    expect(SIZING_CLAMP_LABEL.NONE).toBe('');
    expect(SIZING_CLAMP_LABEL.RAISED_TO_MINIMUM).not.toBe('');
    expect(SIZING_CLAMP_LABEL.LOWERED_TO_MAXIMUM).not.toBe('');
  });

  it('names the engine as the reference policy it is, and never as solved output', () => {
    expect(STRATEGY_ENGINE_LABEL).toBe('기본전략 · REFERENCE');
    const everyString = [
      STRATEGY_ENGINE_LABEL,
      STRATEGY_PRIMARY_BADGE,
      ...Object.values(PROVENANCE_LABEL),
      ...Object.values(CONFIDENCE_LABEL),
      ...Object.values(STRATEGY_FAMILY_LABEL),
      ...Object.values(STRATEGY_UNSUPPORTED_REASON_LABEL),
      ...Object.values(POT_TYPE_LABEL),
      ...Object.values(ENVIRONMENT_STATUS_LABEL),
      ...Object.values(ENVIRONMENT_FACTOR_LABEL),
      ...Object.values(EQUITY_METHOD_LABEL),
      ...Object.values(SIZING_CLAMP_LABEL),
      ...Object.values(STRATEGY_ERROR_LABEL),
    ].join(' ');
    expect(everyString).not.toContain('GTO');
    // `docs/UX.md`: the highest-frequency action is 추천 / PRIMARY, never a verdict.
    expect(STRATEGY_PRIMARY_BADGE).toBe('추천');
    expect(everyString).not.toContain('정답');
    expect(everyString).not.toContain('정확한 액션');
  });

  it('rounds a ratio to a whole percent and never invents a decimal place', () => {
    expect(ratioPercentLabel(0.2317)).toBe('23%');
    expect(ratioPercentLabel(0.605)).toBe('61%');
    expect(ratioPercentLabel(0)).toBe('0%');
    expect(ratioPercentLabel(1)).toBe('100%');
  });

  it('shows SPR to one decimal, because it is a ratio and not money', () => {
    expect(sprLabel(9.9712)).toBe('10.0');
    expect(sprLabel(0)).toBe('0.0');
  });
});

/**
 * 상대 적응 · ADAPTIVE, WP-7. The two sections are shown together now, so the copy that
 * distinguishes them carries the weight: a delta has to be in the right UNIT, an unchanged
 * quantity has to say so, and the no-data state has to name itself without a number in it.
 */
describe('adaptive copy (WP-7)', () => {
  it('renders a frequency delta in percentage POINTS, signed', () => {
    // `AdaptiveAction.deltaBps` is a multiple of 500, so these are the real granularity.
    expect(signedBpsPointsLabel(400)).toBe('+4%p');
    expect(signedBpsPointsLabel(-400)).toBe('-4%p');
    expect(signedBpsPointsLabel(2000)).toBe('+20%p');
  });

  it('names a zero delta instead of printing +0%p', () => {
    expect(signedBpsPointsLabel(0)).toBe('변화 없음');
    expect(ADAPTIVE_NO_CHANGE_LABEL).toBe('변화 없음');
    expect(sizingStepLabel(0)).toBe('사이즈 변화 없음');
  });

  it('keeps %p and % as different units, because they are', () => {
    // The bug this guards: `+4%` beside `64%` reads as 4% OF 64. Stated against the two
    // functions that are still rendered — the signed-PERCENT formatter this used to compare
    // against had no caller left and is gone, so the property is asserted on the unit itself
    // rather than on a dead sibling.
    expect(signedBpsPointsLabel(400)).toBe('+4%p');
    expect(signedBpsPointsLabel(400)).not.toBe('+4%');
    expect(bpsPercentLabel(6400)).toBe('64%');
    expect(bpsPercentLabel(400)).toBe('4%');
  });

  it('says the opponent had no data and that 기본전략 is therefore the whole answer', () => {
    expect(ADAPTIVE_NO_OPPONENT_DATA_LABEL).toBe('상대 데이터 없음');
    expect(ADAPTIVE_SAME_AS_REFERENCE_LABEL).toBe('→ 기본전략과 동일');
    // No number, and nothing that could be read as one: this state HAS no adaptive figure.
    expect(`${ADAPTIVE_NO_OPPONENT_DATA_LABEL} ${ADAPTIVE_SAME_AS_REFERENCE_LABEL}`).not.toMatch(
      /\d/u,
    );
  });

  it('asks the reason question in the user’s own words', () => {
    expect(ADAPTIVE_REASONS_HEADING).toBe('왜 이렇게 바뀌었나요?');
  });

  it('never lets the adaptive layer claim solved output', () => {
    const everyString = [
      ADAPTIVE_ENGINE_LABEL,
      ADAPTIVE_NO_CHANGE_LABEL,
      ADAPTIVE_NO_OPPONENT_DATA_LABEL,
      ADAPTIVE_REASONS_HEADING,
      ADAPTIVE_SAME_AS_REFERENCE_LABEL,
      ADAPTIVE_UNCHANGED_LABEL,
      ADAPTIVE_UNCHANGED_PLAIN_REASON,
      SIZING_RECOMMENDATION_LABEL,
      adaptiveOpponentLabel('Shadow7'),
    ].join(' ');
    expect(everyString).not.toContain('GTO');
    expect(everyString).not.toContain('정답');
  });

  it('names the villain the rules were keyed to', () => {
    expect(adaptiveOpponentLabel('Shadow7')).toBe('상대: Shadow7');
    expect(adaptiveOpponentLabel(seatLabel(2))).toBe('상대: 좌석 3');
  });
});

/**
 * V2 WP-1..WP-5 copy, written here ahead of the components that render it. These strings say
 * what actually happened to the user's data, so each test below is about a distinction the
 * wording must not blur.
 */
describe('seat correction and hand progression copy', () => {
  it('describes a rebase as a rebuild of THIS hand, not as a new one', () => {
    expect(HAND_REBASED_NOTICE).toBe('좌석 변경으로 현재 핸드를 처음부터 다시 구성했습니다.');
    // A rebase never advances the hand number and never rotates the button (design §1.1), so
    // the notice may not read as "next hand".
    expect(HAND_REBASED_NOTICE).not.toContain('다음 핸드');
  });

  it('warns that a quick skip loses action and leaves stacks unverified', () => {
    expect(QUICK_NEXT_HAND_LABEL).toBe('빠른 다음 핸드');
    expect(QUICK_NEXT_HAND_DESCRIPTION).toContain('기록하지 않고');
    expect(QUICK_NEXT_HAND_DESCRIPTION).toContain('상대 스택은 다음 핸드 전에 확인하세요');
  });

  it('separates the dirty-seat STATE from the dirty-seat INSTRUCTION', () => {
    expect(SEAT_DIRTY_BADGE).toBe('확인 필요');
    expect(SEAT_DIRTY_ACTION_LABEL).toBe('스택 입력');
    expect(SEAT_DIRTY_BADGE).not.toBe(SEAT_DIRTY_ACTION_LABEL);
    // Neither claims the stored number is wrong — only that nobody observed it.
    expect(`${SEAT_DIRTY_BADGE} ${SEAT_DIRTY_ACTION_LABEL}`).not.toContain('틀림');
  });

  it('labels a player swap and gives a reason rather than silently hiding a candidate', () => {
    expect(PLAYER_SWAP_LABEL).toBe('플레이어 변경');
    expect(PLAYER_SWAP_NEW_LABEL).toBe('새 플레이어 추가');
    for (const label of Object.values(PLAYER_SWAP_REJECTION_LABEL)) expect(label).not.toBe('');
    expect(PLAYER_SWAP_REJECTION_LABEL.ALREADY_SEATED).toContain('이미');
  });

  it('explains a rejected stack by which mistake was actually made', () => {
    expect(STACK_EDIT_LABEL).toBe('스택 수정');
    expect(STACK_EDIT_REJECTION_LABEL.NOT_A_NUMBER).not.toBe(
      STACK_EDIT_REJECTION_LABEL.NOT_POSITIVE,
    );
    for (const label of Object.values(STACK_EDIT_REJECTION_LABEL)) expect(label).not.toBe('');
  });
});

/**
 * The external HUD import form. Exhaustiveness over `ExternalHudStatKey` is a TYPE property of
 * the map; what these add is that the labels match the notation on the screen the user is
 * copying from, and that an empty field's meaning is stated rather than discovered.
 */
describe('external HUD copy', () => {
  it('labels all 10 stats in the source HUD’s own notation', () => {
    expect(Object.keys(EXTERNAL_HUD_STAT_LABEL)).toHaveLength(10);
    for (const key of EXTERNAL_HUD_STAT_KEYS) {
      expect(EXTERNAL_HUD_STAT_LABEL[key]).not.toBe('');
    }
    expect(EXTERNAL_HUD_STAT_LABEL.VPIP).toBe('VPIP');
    expect(EXTERNAL_HUD_STAT_LABEL.THREE_BET).toBe('3Bet');
    expect(EXTERNAL_HUD_STAT_LABEL.FOLD_TO_THREE_BET).toBe('Fold to 3Bet');
    expect(EXTERNAL_HUD_STAT_LABEL.CBET_ANY_STREET).toBe('CBet');
    expect(EXTERNAL_HUD_STAT_LABEL.FOLD_TO_CBET_ANY_STREET).toBe('Fold to CBet');
    expect(EXTERNAL_HUD_STAT_LABEL.CHECK_RAISE_ANY_STREET).toBe('Check/Raise');
    expect(EXTERNAL_HUD_STAT_LABEL.WSD).toBe('WSD');
  });

  it('carries no street in the generic readings, exactly as the source reports them', () => {
    for (const key of [
      'CBET_ANY_STREET',
      'FOLD_TO_CBET_ANY_STREET',
      'CHECK_RAISE_ANY_STREET',
    ] as const) {
      expect(EXTERNAL_HUD_STAT_LABEL[key]).not.toMatch(/플랍|턴|리버|Flop|Turn|River/u);
    }
  });

  it('says an empty field means UNKNOWN and is never stored as zero', () => {
    expect(EXTERNAL_HUD_EMPTY_MEANS_UNKNOWN_HINT).toContain(EXTERNAL_HUD_UNKNOWN_LABEL);
    expect(EXTERNAL_HUD_EMPTY_MEANS_UNKNOWN_HINT).toContain('0%로 저장되지 않습니다');
  });

  it('keeps a glossary sentence for every labelled stat', () => {
    for (const key of EXTERNAL_HUD_GLOSSARY_ORDER) {
      expect(EXTERNAL_HUD_STAT_LABEL[key]).not.toBe('');
      expect(EXTERNAL_HUD_GLOSSARY[key]).not.toBe('');
    }
  });
});

describe('FAST TABLE UX V3 copy', () => {
  it('never restates REFERENCE/ADAPTIVE in the new headline/comparison/disclosure copy', () => {
    // ADR-0056 pins `STRATEGY_ENGINE_LABEL`/`ADAPTIVE_ENGINE_LABEL` themselves (asserted
    // above, unchanged) — these new strings exist precisely so the fast read never has to
    // repeat that fixed name a second time.
    for (const label of [
      RECOMMENDATION_HEADLINE_LABEL,
      COMPARISON_ADAPTIVE_ROW_LABEL,
      COMPARISON_BASELINE_ROW_LABEL,
      COMPARISON_DELTA_ROW_LABEL,
      REASON_DISCLOSURE_LABEL,
      TECHNICAL_DETAIL_DISCLOSURE_LABEL,
      HERO_FOLDED_FAST_SKIP_HINT,
      QUICK_HUD_LINE_LABEL,
    ]) {
      expect(label).not.toMatch(/REFERENCE|ADAPTIVE/u);
    }
  });

  it('states the quick HUD line field order, matching EXTERNAL_HUD_STAT_KEYS canonical order', () => {
    expect(QUICK_HUD_LINE_ORDER_HINT).toContain(
      'VPIP PFR 3Bet Fold3Bet Steal CBet FoldCBet CheckRaise WTSD WSD',
    );
  });

  it('names the expected count and echoes the order hint on a wrong token count', () => {
    const message = quickHudLineCountError(10, 7);
    expect(message).toContain('10');
    expect(message).toContain('7');
    expect(message).toContain(QUICK_HUD_LINE_ORDER_HINT);
  });

  it('names the position, field label and offending token on an invalid value', () => {
    const message = quickHudLineValueError(3, 'Steal', '150');
    expect(message).toContain('3');
    expect(message).toContain('Steal');
    expect(message).toContain('150');
  });
});
