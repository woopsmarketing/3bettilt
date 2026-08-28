/** Branded string ids, so a PlayerId can never be passed where a HandId belongs. */
declare const ID_BRAND: unique symbol;
export type Id<TTag extends string> = string & { readonly [ID_BRAND]: TTag };

export type PlayerId = Id<'Player'>;
export type SessionId = Id<'Session'>;
export type HandId = Id<'Hand'>;
export type EventId = Id<'Event'>;
export type SnapshotId = Id<'Snapshot'>;
export type NoteId = Id<'Note'>;
export type ObservationId = Id<'Observation'>;
export type SolutionSetId = Id<'SolutionSet'>;
export type SpotId = Id<'Spot'>;
export type NodeId = Id<'Node'>;

export const asId = <TTag extends string>(value: string): Id<TTag> => value as Id<TTag>;

/**
 * Random id source. Injectable so replay/tests stay deterministic — domain code
 * that needs an id must accept an `IdFactory`, never call `randomUUID` inline.
 */
export interface IdFactory {
  next(): string;
}

export const cryptoIdFactory: IdFactory = {
  next: () => globalThis.crypto.randomUUID(),
};

/** Deterministic factory for tests and replay fixtures: "prefix-1", "prefix-2", ... */
export function sequentialIdFactory(prefix = 'id'): IdFactory {
  let counter = 0;
  return { next: () => `${prefix}-${++counter}` };
}
