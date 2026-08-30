import { describe, expect, it } from 'vitest';
import { SEAT_INDEXES } from '@gto-self/poker-core';
import { rightPanelFor } from './rightPanel.js';

describe('rightPanelFor', () => {
  it('leads with the strategy panel when hero is the seat on the clock', () => {
    expect(rightPanelFor({ selectedPlayerSeat: null, heroIsActor: true })).toBe('STRATEGY');
  });

  it('leads with the player panel when a seat is selected', () => {
    expect(rightPanelFor({ selectedPlayerSeat: 2, heroIsActor: false })).toBe('PLAYER');
  });

  it('falls back to the action history when neither holds', () => {
    expect(rightPanelFor({ selectedPlayerSeat: null, heroIsActor: false })).toBe('HISTORY');
  });

  /**
   * The documented overlap: an explicit selection outranks "hero is to act", because the
   * selection is a user act with an explicit undo (`Esc`) and hero-to-act is not.
   */
  it('keeps a selected seat visible even while hero is to act', () => {
    expect(rightPanelFor({ selectedPlayerSeat: 4, heroIsActor: true })).toBe('PLAYER');
  });

  it('resolves hero’s own selected seat to the player panel, not to strategy', () => {
    expect(rightPanelFor({ selectedPlayerSeat: 0, heroIsActor: true })).toBe('PLAYER');
  });

  it('treats a seat with nobody in it as no selection at all', () => {
    // `TableRoot` passes `null` for a seat with no `playerId`, so an empty seat can never
    // select a profile that does not exist.
    expect(rightPanelFor({ selectedPlayerSeat: null, heroIsActor: true })).toBe('STRATEGY');
    expect(rightPanelFor({ selectedPlayerSeat: null, heroIsActor: false })).toBe('HISTORY');
  });

  it('answers for every physical seat', () => {
    for (const seat of SEAT_INDEXES) {
      expect(rightPanelFor({ selectedPlayerSeat: seat, heroIsActor: false })).toBe('PLAYER');
      expect(rightPanelFor({ selectedPlayerSeat: seat, heroIsActor: true })).toBe('PLAYER');
    }
  });
});
