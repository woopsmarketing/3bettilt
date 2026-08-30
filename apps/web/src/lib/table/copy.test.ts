import { describe, expect, it } from 'vitest';
import type { CardEntryRequest } from './cardEntry.js';
import {
  ACTION_LABEL,
  CARD_ENTRY_LABEL,
  PHASE_LABEL,
  POSITION_LABEL,
  SEAT_STATUS_LABEL,
  STREET_LABEL,
  cardEntryHeading,
  phaseLabel,
  seatLabel,
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
