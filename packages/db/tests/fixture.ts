/**
 * The hand fixture the persistence tests round-trip.
 *
 * It deliberately exercises every Phase-2 addition to the event shape, because those are
 * exactly the fields a schema written against an older description would silently drop:
 * `HAND_STARTED.blindOverride`, `POST_DEAD_BLIND`, a non-zero `rake` AND a non-zero `fee`
 * on `POT_AWARDED`, and `HAND_FINISHED.totalFees`.
 *
 * Built through `poker-core`'s public API only. Everything throws on an Err: a broken
 * fixture is a bug in the fixture, not a test outcome.
 */
import {
  asId,
  Money,
  parseCards,
  sequentialIdFactory,
  unwrap,
  type HandId,
  type IdFactory,
  type MilliBB,
  type PlayerId,
} from '@gto-self/shared';
import {
  applyCommands,
  awardPots,
  call,
  check,
  createTable,
  CP_NL50_6MAX_ANTE,
  dealBoard,
  fold,
  raiseTo,
  seatPlayer,
  setButtonSeat,
  setHeroSeat,
  startHand,
  type Hand,
  type TableConfig,
  type TableState,
} from '@gto-self/poker-core';
import type { DatabaseHandle } from '../src/client.js';

/** The shipped NL50 preset with the splash fee switched to MANUAL so a fee can be recorded. */
export const MANUAL_FEE_PRESET: TableConfig = {
  ...CP_NL50_6MAX_ANTE,
  presetId: 'TEST_NL50_MANUAL_FEE',
  label: 'NL50 6-max, manual splash fee',
  fee: { ...CP_NL50_6MAX_ANTE.fee, triggerPolicy: 'MANUAL' },
};

export const BB = (bb: number): MilliBB => Money.fromBB(bb);

/** Four seats, 100 BB each, button on seat 0, hero on seat 0. */
export function buildTable(config: TableConfig = MANUAL_FEE_PRESET): TableState {
  let table = unwrap(createTable(config));
  for (const seat of [0, 1, 2, 3] as const) {
    table = unwrap(seatPlayer(table, seat, asId<'Player'>(`seat-${seat}`) as PlayerId, BB(100)));
  }
  table = unwrap(setButtonSeat(table, 0));
  return unwrap(setHeroSeat(table, 0));
}

export const fixtureIds = (prefix = 'ev'): IdFactory => sequentialIdFactory(prefix);

/** The manually supplied splash fee this fixture records. A multiple of the 20 mBB quantum. */
export const FIXTURE_FEE: MilliBB = Money.mbb(200);

/**
 * A complete four-handed hand:
 * ante 0.16 BB each, a DEAD BLIND at seat 1, a manual SB/BB override onto seats 2 and 3,
 * an open from seat 0 called by the big blind, a checked-down board, and one awarded pot
 * carrying both a rake and a manual splash fee.
 */
export function buildFixtureHand(
  table: TableState = buildTable(),
  handId = 'hand-fixture-1',
): Hand {
  const ids = fixtureIds();
  const hand = unwrap(
    startHand(
      table,
      {
        handId: asId<'Hand'>(handId) as HandId,
        blindOverride: { smallBlindSeat: 2, bigBlindSeat: 3 },
        deadBlinds: [{ seat: 1, amount: BB(0.5) }],
      },
      ids,
    ),
  );
  return unwrap(
    applyCommands(
      hand,
      [
        raiseTo(BB(3)),
        fold(),
        fold(),
        call(),
        dealBoard(unwrap(parseCards('Ah Kd 7c'))),
        check(),
        check(),
        dealBoard(unwrap(parseCards('2s'))),
        check(),
        check(),
        dealBoard(unwrap(parseCards('9h'))),
        check(),
        check(),
        awardPots([{ potIndex: 0, winners: [0] }], FIXTURE_FEE),
      ],
      ids,
    ),
  );
}

/**
 * Run `mutate` with the insert-only triggers temporarily removed, then put them back
 * EXACTLY as the migration created them (the DDL is read back out of `sqlite_master`, not
 * retyped here, so this helper cannot drift from `0001_insert_only_guards.sql`).
 *
 * This is how a test simulates a database corrupted BY OTHER MEANS — a hand-edited file, a
 * different tool — which is the only situation the read-time `CORRUPT_ROW` checks exist
 * for. Nothing in `src/` may do this, and no test may use it to reach a repository path.
 */
export function withoutInsertOnlyGuards(handle: DatabaseHandle, mutate: () => void): void {
  const triggers = handle.sqlite
    .prepare(`select name, sql from sqlite_master where type = 'trigger'`)
    .all() as readonly { readonly name: string; readonly sql: string }[];
  if (triggers.length === 0) throw new Error('no insert-only triggers found to drop');
  for (const trigger of triggers) handle.sqlite.exec(`drop trigger "${trigger.name}"`);
  try {
    mutate();
  } finally {
    for (const trigger of triggers) handle.sqlite.exec(trigger.sql);
  }
}
