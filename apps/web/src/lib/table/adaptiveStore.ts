/**
 * The 상대 적응 · ADAPTIVE input store — everything the composition layer is allowed to know
 * about the opponents currently seated, and nothing else.
 *
 * ---------------------------------------------------------------------------------------
 * IT HOLDS NO POKER STATE AND IT WRITES NOTHING.
 *
 * `tableStore` owns the hand; this store owns a `Record<playerId, AdaptiveOpponentInputWire>`
 * that the server action filled in. There is deliberately no overlap: a bug here can make the
 * ADAPTIVE panel wrong, and it can never make the TABLE wrong. It also has no server action of
 * its own — the caller loads, this store remembers — so nothing in it can await, retry or
 * fail, and no hand transition can ever end up waiting on it (ADR-0043).
 *
 * WHY THERE IS A `version` COUNTER BESIDE A RECORD THAT IS ALREADY REPLACED WHOLESALE.
 *
 * `StrategyPanel` recomputes ADAPTIVE in a `useMemo` (WP-J design contract §6). The memo has to
 * re-run when a HUD reading is saved mid-hand, and `version` is the explicit, monotonic signal
 * that says "the inputs are not what they were" — an integer a component can read, a test can
 * assert on, and a future mutation that edited the record in place could not silently defeat.
 * Both mutators bump it, including a `replaceInputs` that happens to write an equal record: a
 * load DID happen, and saying otherwise would make the counter mean something softer than it
 * does.
 *
 * A FAILED LOAD IS NOT REPRESENTED HERE. The caller's answer to a failed read is to leave the
 * store as it is, or to replace it with nothing; either way ADAPTIVE reports that it has no
 * data (`INSUFFICIENT_DATA`) rather than adapting against a partial table. This store has no
 * error state because it makes no request — see `TableRoot`'s loader for the degraded path.
 * ---------------------------------------------------------------------------------------
 */
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { AdaptiveOpponentInputWire } from './contract.js';

/** Opponent inputs, keyed by the player id they were read for. */
export type AdaptiveInputMap = Readonly<Record<string, AdaptiveOpponentInputWire>>;

export interface AdaptiveStoreState {
  readonly inputs: AdaptiveInputMap;
  /** Bumped by every mutation. Monotonic; never reset. */
  readonly version: number;
  /**
   * The whole lineup, after a load. Replaces the map: a player who is no longer at the table
   * must not keep contributing a profile, and dropping them is the only way to say that.
   */
  replaceInputs(inputs: readonly AdaptiveOpponentInputWire[]): void;
  /** ONE player's freshly-read input, after their HUD reading was saved. */
  upsertInput(input: AdaptiveOpponentInputWire): void;
}

export type AdaptiveStore = StoreApi<AdaptiveStoreState>;

/**
 * The map as a list, in SEAT order.
 *
 * Object key order is insertion order, which is a load-time accident; seat order is a fact
 * about the table. `composeAdaptive` is deterministic in the order its profiles arrive, so
 * fixing that order here is what makes two renders of the same table produce the same bytes.
 */
export function adaptiveOpponentList(
  inputs: AdaptiveInputMap,
): readonly AdaptiveOpponentInputWire[] {
  return Object.values(inputs).sort((left, right) => left.seatIndex - right.seatIndex);
}

export function createAdaptiveStore(): AdaptiveStore {
  return createStore<AdaptiveStoreState>()((set, get) => ({
    inputs: {},
    version: 0,

    replaceInputs(inputs: readonly AdaptiveOpponentInputWire[]) {
      const next: Record<string, AdaptiveOpponentInputWire> = {};
      // Last wins on a duplicated player id. The server action already refuses a lineup that
      // seats the same person twice, so this is only the shape of the reduction, not a policy.
      for (const input of inputs) next[input.playerId] = input;
      set({ inputs: next, version: get().version + 1 });
    },

    upsertInput(input: AdaptiveOpponentInputWire) {
      set({
        inputs: { ...get().inputs, [input.playerId]: input },
        version: get().version + 1,
      });
    },
  }));
}
