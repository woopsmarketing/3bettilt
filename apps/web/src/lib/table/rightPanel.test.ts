import { describe, expect, it } from 'vitest';
import { SEAT_INDEXES } from '@gto-self/poker-core';
import { rightPanelLayoutFor, type RightPanelInput } from './rightPanel.js';

/** Every input the function can be given: 6 seats plus "no selection", times both actor states. */
const EVERY_INPUT: readonly RightPanelInput[] = [null, ...SEAT_INDEXES].flatMap(
  (selectedPlayerSeat) => [true, false].map((heroIsActor) => ({ selectedPlayerSeat, heroIsActor })),
);

describe('rightPanelLayoutFor', () => {
  it('leads with the strategy panel when hero is the seat on the clock', () => {
    expect(rightPanelLayoutFor({ selectedPlayerSeat: null, heroIsActor: true })).toEqual({
      lead: 'STRATEGY',
      drawer: null,
    });
  });

  it('leads with the player panel when a seat is selected and hero is not to act', () => {
    expect(rightPanelLayoutFor({ selectedPlayerSeat: 2, heroIsActor: false })).toEqual({
      lead: 'PLAYER',
      drawer: null,
    });
  });

  it('falls back to the action history when neither holds', () => {
    expect(rightPanelLayoutFor({ selectedPlayerSeat: null, heroIsActor: false })).toEqual({
      lead: 'HISTORY',
      drawer: null,
    });
  });

  /**
   * WP-9, and the reason this contract was inverted: the two conditions can both be true, and
   * the column now answers BOTH instead of choosing. Clicking an opponent while hero is on the
   * clock is how a person checks who they are up against — it must not delete the answer they
   * were checking for.
   */
  it('opens the profile as a DRAWER under the strategy while hero is to act', () => {
    expect(rightPanelLayoutFor({ selectedPlayerSeat: 4, heroIsActor: true })).toEqual({
      lead: 'STRATEGY',
      drawer: 'PLAYER',
    });
  });

  it('treats hero’s own selected seat the same way — strategy leads, profile opens below', () => {
    expect(rightPanelLayoutFor({ selectedPlayerSeat: 0, heroIsActor: true })).toEqual({
      lead: 'STRATEGY',
      drawer: 'PLAYER',
    });
  });

  it('treats a seat with nobody in it as no selection at all', () => {
    // `TableRoot` passes `null` for a seat with no `playerId`, so an empty seat can never
    // select a profile that does not exist — and, now, can never open an empty drawer.
    expect(rightPanelLayoutFor({ selectedPlayerSeat: null, heroIsActor: true })).toEqual({
      lead: 'STRATEGY',
      drawer: null,
    });
    expect(rightPanelLayoutFor({ selectedPlayerSeat: null, heroIsActor: false })).toEqual({
      lead: 'HISTORY',
      drawer: null,
    });
  });

  it('answers for every physical seat', () => {
    for (const seat of SEAT_INDEXES) {
      expect(rightPanelLayoutFor({ selectedPlayerSeat: seat, heroIsActor: false })).toEqual({
        lead: 'PLAYER',
        drawer: null,
      });
      expect(rightPanelLayoutFor({ selectedPlayerSeat: seat, heroIsActor: true })).toEqual({
        lead: 'STRATEGY',
        drawer: 'PLAYER',
      });
    }
  });

  /**
   * The property, over the WHOLE input space rather than over examples. "The strategy panel
   * vanished because I clicked a seat" is the bug WP-9 exists to remove, so no input may
   * produce it — not a new seat, not a future combination, not a refactor of the branches.
   */
  it('has no input at all where hero is the actor and strategy is not the lead', () => {
    expect(EVERY_INPUT).toHaveLength(14);
    for (const input of EVERY_INPUT) {
      if (input.heroIsActor) {
        expect(rightPanelLayoutFor(input).lead).toBe('STRATEGY');
      }
    }
  });

  it('never opens a drawer for a seat that is not selected', () => {
    for (const input of EVERY_INPUT) {
      if (input.selectedPlayerSeat === null) {
        expect(rightPanelLayoutFor(input).drawer).toBeNull();
      }
    }
  });

  it('never hides a selected profile entirely — it is always the lead or the drawer', () => {
    for (const input of EVERY_INPUT) {
      if (input.selectedPlayerSeat === null) continue;
      const layout = rightPanelLayoutFor(input);
      expect(layout.lead === 'PLAYER' || layout.drawer === 'PLAYER').toBe(true);
    }
  });
});

describe('the selection no longer outranks a hero decision', () => {
  /**
   * The inverted behaviour WP-9 removed, asserted directly against the ONE function that is
   * left. `rightPanelFor` — the single-slot compatibility read this pair used to go through —
   * is gone with its last caller; the property it was carrying is stated here instead, so
   * deleting the function did not delete the assertion.
   */
  it('leads with STRATEGY for a selected seat while hero is to act, and with PLAYER otherwise', () => {
    expect(rightPanelLayoutFor({ selectedPlayerSeat: 4, heroIsActor: true })).toEqual({
      lead: 'STRATEGY',
      drawer: 'PLAYER',
    });
    expect(rightPanelLayoutFor({ selectedPlayerSeat: 4, heroIsActor: false })).toEqual({
      lead: 'PLAYER',
      drawer: null,
    });
  });
});
