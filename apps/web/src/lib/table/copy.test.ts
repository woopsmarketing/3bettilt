import { describe, expect, it } from 'vitest';
import type { CardEntryRequest } from './cardEntry.js';
import {
  ACTION_LABEL,
  CARD_ENTRY_LABEL,
  CONFIDENCE_LABEL,
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

  it('says the toggle already took effect when no hand is holding it up', () => {
    expect(seatOccupancyToggleState('ACTIVE', false)).toBe('끔');
    expect(seatOccupancyToggleState('SITTING_OUT', false)).toBe('켬');
  });

  it('says "next hand" in BOTH directions while a live hand disagrees with the seat', () => {
    expect(seatOccupancyToggleState('SITTING_OUT', true)).toBe('다음 핸드부터');
    // R1 MINOR-12: re-activation only takes effect on the next deal too, so it must not
    // claim '끔' the moment it is toggled.
    expect(seatOccupancyToggleState('ACTIVE', true)).toBe('다음 핸드부터');
    expect(seatOccupancyToggleState('ACTIVE', true)).not.toBe(
      seatOccupancyToggleState('ACTIVE', false),
    );
  });

  it('keeps a state label for every occupancy in both timings', () => {
    for (const timings of Object.values(SEAT_OCCUPANCY_TOGGLE_STATE)) {
      for (const label of Object.values(timings)) expect(label).not.toBe('');
    }
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
