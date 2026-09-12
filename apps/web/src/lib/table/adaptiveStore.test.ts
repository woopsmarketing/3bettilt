import { describe, expect, it } from 'vitest';
import { adaptiveOpponentList, createAdaptiveStore, type AdaptiveStore } from './adaptiveStore.js';
import type { AdaptiveOpponentInputWire } from './contract.js';

/**
 * The ADAPTIVE input store.
 *
 * Two properties are worth a test and the rest is bookkeeping:
 *
 * 1. `version` moves on every mutation, INCLUDING a replace that happens to write an equal
 *    map. It is the panel's "the inputs are not what they were" signal, and a counter that
 *    silently stood still for a load would make a HUD save look like it changed nothing.
 * 2. `replaceInputs` REPLACES. A player who left the table must stop contributing a profile,
 *    which a merge would never achieve.
 */

const input = (
  playerId: string,
  seatIndex: number,
  valueBps = 5000,
): AdaptiveOpponentInputWire => ({
  playerId,
  seatIndex,
  nickname: `seat ${seatIndex}`,
  observations: [
    { key: 'FOLD_TO_CBET_FLOP', source: 'MANUAL_HUD', valueBps, sampleN: 100, note: null },
  ],
  manualHudSnapshotId: `hud-${playerId}`,
  manualHudRecordedAt: 1_700_000_000_000,
  learnedSnapshotId: null,
  learnedModelVersion: null,
  externalHudSnapshotId: null,
  externalHudRecordedAt: null,
});

const store = (): AdaptiveStore => createAdaptiveStore();

describe('adaptiveStore', () => {
  it('starts empty, at version 0, holding no poker state at all', () => {
    const state = store().getState();
    expect(state.inputs).toEqual({});
    expect(state.version).toBe(0);
    // The store's whole surface: two mutators over one map plus the counter. Nothing about a
    // hand, a seat, a stack or a table can be reached through it.
    expect(Object.keys(state).sort()).toEqual([
      'inputs',
      'replaceInputs',
      'upsertInput',
      'version',
    ]);
  });

  it('replaces the whole lineup and bumps the version', () => {
    const api = store();
    api.getState().replaceInputs([input('p1', 0), input('p2', 3)]);

    expect(api.getState().version).toBe(1);
    expect(Object.keys(api.getState().inputs).sort()).toEqual(['p1', 'p2']);
    expect(api.getState().inputs.p1?.seatIndex).toBe(0);
  });

  it('drops a player the new lineup does not contain', () => {
    const api = store();
    api.getState().replaceInputs([input('p1', 0), input('p2', 3)]);
    api.getState().replaceInputs([input('p2', 3)]);

    // Not a merge: p1 stood up, so p1's profile is gone rather than lingering as a stale read
    // of a seat somebody else now occupies.
    expect(Object.keys(api.getState().inputs)).toEqual(['p2']);
    expect(api.getState().version).toBe(2);
  });

  it('bumps the version even when the replacement is an equal map', () => {
    const api = store();
    api.getState().replaceInputs([input('p1', 0)]);
    const first = api.getState().inputs;
    api.getState().replaceInputs([input('p1', 0)]);

    expect(api.getState().inputs).toEqual(first);
    // A load DID happen. The counter says so, and a memo keyed on it re-runs.
    expect(api.getState().version).toBe(2);
  });

  it('upserts ONE player without disturbing the others, and bumps the version', () => {
    const api = store();
    api.getState().replaceInputs([input('p1', 0, 4000), input('p2', 3, 4000)]);
    const before = api.getState().inputs.p2;

    api.getState().upsertInput(input('p1', 0, 9000));

    expect(api.getState().version).toBe(2);
    expect(api.getState().inputs.p1?.observations[0]?.valueBps).toBe(9000);
    // The untouched player's object is the SAME object, not an equal copy.
    expect(api.getState().inputs.p2).toBe(before);
  });

  it('adds a player the lineup load never returned', () => {
    const api = store();
    api.getState().upsertInput(input('p9', 5));
    expect(Object.keys(api.getState().inputs)).toEqual(['p9']);
    expect(api.getState().version).toBe(1);
  });

  it('never mutates the previous map in place', () => {
    const api = store();
    api.getState().replaceInputs([input('p1', 0)]);
    const snapshot = api.getState().inputs;
    api.getState().upsertInput(input('p2', 1));

    expect(Object.keys(snapshot)).toEqual(['p1']);
    expect(api.getState().inputs).not.toBe(snapshot);
  });

  it('lists opponents in SEAT order, whatever order they were loaded in', () => {
    const api = store();
    api.getState().replaceInputs([input('p5', 5), input('p0', 0), input('p3', 3)]);

    expect(adaptiveOpponentList(api.getState().inputs).map((entry) => entry.seatIndex)).toEqual([
      0, 3, 5,
    ]);
  });

  it('notifies subscribers on every mutation', () => {
    const api = store();
    const versions: number[] = [];
    const unsubscribe = api.subscribe((state) => versions.push(state.version));

    api.getState().replaceInputs([input('p1', 0)]);
    api.getState().upsertInput(input('p1', 0, 7000));
    api.getState().replaceInputs([]);
    unsubscribe();
    api.getState().upsertInput(input('p1', 0));

    expect(versions).toEqual([1, 2, 3]);
  });
});
