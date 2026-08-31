/**
 * TEST-ONLY fixtures, built through `poker-core`'s PUBLIC api.
 *
 * NOT exported from the package barrel. Every fixture is a real hand: it goes through
 * `createTable` / `seatPlayer` / `startHand` / `applyCommands`, so the events, the action
 * records and the legality of every line are the engine's, not this file's. A fixture that
 * hand-wrote a `HandState` literal would drift from the engine the moment the engine
 * changed, and the whole point of these tests is that the opportunity denominators come
 * from the real action flow.
 *
 * Standard 6-max seating used throughout, button on seat 0:
 *
 * ```
 *   seat 0 = BTN   seat 1 = SB   seat 2 = BB   seat 3 = UTG   seat 4 = HJ   seat 5 = CO
 * ```
 *
 * Preflop action order: UTG(3) -> HJ(4) -> CO(5) -> BTN(0) -> SB(1) -> BB(2).
 * Postflop action order: SB(1) -> BB(2) -> UTG(3) -> HJ(4) -> CO(5) -> BTN(0).
 *
 * Five-handed (seats 0..4) drops UTG: seat 3 becomes HJ and seat 4 stays CO.
 */
import {
  asId,
  Money,
  parseCards,
  sequentialIdFactory,
  unwrap,
  type Card,
  type HandId,
  type MilliBB,
  type PlayerId,
} from '@gto-self/shared';
import {
  applyCommands,
  createTable,
  CP_NL50_6MAX_NO_ANTE,
  seatPlayer,
  setButtonSeat,
  startHand,
  type Hand,
  type HandCommand,
  type SeatIndex,
  type TableConfig,
  type TableState,
} from '@gto-self/poker-core';

export const BB = (bb: number): MilliBB => Money.fromBB(bb);

/** `p<seat>` — a stable, readable player id per seat. */
export const player = (seat: SeatIndex): PlayerId => asId<'Player'>(`p${seat}`) as PlayerId;

export interface TableSpec {
  /** The seats that are DEALT IN. Anything omitted is sitting out / empty. */
  readonly seats: readonly SeatIndex[];
  readonly buttonSeat?: SeatIndex;
  readonly stacks?: Readonly<Partial<Record<SeatIndex, MilliBB>>>;
  readonly config?: TableConfig;
}

/** Throws on any engine rejection: a broken fixture must fail loudly. */
export function buildTable(spec: TableSpec): TableState {
  let table = unwrap(createTable(spec.config ?? CP_NL50_6MAX_NO_ANTE));
  for (const seat of spec.seats) {
    const stack = spec.stacks?.[seat] ?? BB(100);
    table = unwrap(seatPlayer(table, seat, player(seat), stack));
  }
  table = unwrap(setButtonSeat(table, spec.buttonSeat ?? 0));
  return table;
}

/** Starts a hand on `table` and applies `commands`. Throws on any Err. */
export function playHand(
  table: TableState,
  handId: string,
  commands: readonly HandCommand[],
): Hand {
  const ids = sequentialIdFactory(`${handId}-e`);
  const started = unwrap(startHand(table, { handId: asId<'Hand'>(handId) as HandId }, ids));
  if (commands.length === 0) return started;
  return unwrap(applyCommands(started, commands, ids));
}

/** Six 100 BB stacks in seats 0..5, button on seat 0. */
export const sixHanded = (handId: string, commands: readonly HandCommand[]): Hand =>
  playHand(buildTable({ seats: [0, 1, 2, 3, 4, 5] }), handId, commands);

/** Five 100 BB stacks in seats 0..4, button on seat 0. Seat 5 is sitting out. */
export const fiveHanded = (handId: string, commands: readonly HandCommand[]): Hand =>
  playHand(buildTable({ seats: [0, 1, 2, 3, 4] }), handId, commands);

/** Four 100 BB stacks in seats 0..3, button on seat 0. Seats 4 and 5 are sitting out. */
export const fourHanded = (handId: string, commands: readonly HandCommand[]): Hand =>
  playHand(buildTable({ seats: [0, 1, 2, 3] }), handId, commands);

export const cards = (text: string): readonly Card[] => unwrap(parseCards(text));

/** `DEAL_BOARD` for the three flop cards. */
export const flop = (text = 'Ah 7d 2c'): HandCommand => ({
  kind: 'DEAL_BOARD',
  cards: cards(text),
});
export const turn = (text = 'Ks'): HandCommand => ({ kind: 'DEAL_BOARD', cards: cards(text) });
export const river = (text = '3h'): HandCommand => ({ kind: 'DEAL_BOARD', cards: cards(text) });

/** A showdown reveal: `revealed: true`, which is the ONLY source of card evidence. */
export const show = (seat: SeatIndex, text: string): HandCommand => ({
  kind: 'SET_HOLE_CARDS',
  seat,
  cards: cards(text),
  revealed: true,
});

/** Hero's own private entry: `revealed: false`. Never card evidence about an opponent. */
export const holeCards = (seat: SeatIndex, text: string): HandCommand => ({
  kind: 'SET_HOLE_CARDS',
  seat,
  cards: cards(text),
  revealed: false,
});

/** Awards the single main pot to `winners` (one seat, or several for a split). */
export const award = (...winners: readonly SeatIndex[]): HandCommand => ({
  kind: 'AWARD_POTS',
  awards: [{ potIndex: 0, winners }],
});

/** Awards several pots at once (a side-pot hand). */
export const awardPots = (
  ...awards: readonly { readonly potIndex: number; readonly winners: readonly SeatIndex[] }[]
): HandCommand => ({ kind: 'AWARD_POTS', awards });
