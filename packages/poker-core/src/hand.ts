/**
 * The public hand lifecycle: start, apply, undo, replay, load, time-travel.
 *
 * `Hand.state` is always exactly the fold of `Hand.events` — every function here refolds
 * from scratch rather than patching, so "state is a pure fold over events" stays
 * literally true and there is nowhere for drift to hide.
 */
import { invariant, ok, type IdFactory } from '@gto-self/shared';
import { engineErr, type EngineResult } from './errors.js';
import {
  buildStartEvents,
  composeStartEvents,
  expandCommand,
  validateCommand,
  type HandCommand,
  type RosterEntry,
  type StartHandOptions,
} from './commands.js';
import { lastCommandSeq, type HandEvent } from './events.js';
import { foldEvents } from './reduce.js';
import type { HandState } from './state.js';
import type { TableState } from './table.js';
import type { PotAwardInput } from './settlement.js';

/**
 * `state` is always exactly the fold of `events`. Kept as a separate field so
 * `loadHand(hand.events).value.state` deep-equalling `hand.state` is a testable property.
 */
export interface Hand {
  readonly events: readonly HandEvent[];
  readonly state: HandState;
}

function handOf(events: readonly HandEvent[]): Hand {
  return { events, state: foldEvents(events) };
}

/** Result. Wraps `buildStartEvents` + `foldEvents`. */
export function startHand(
  table: TableState,
  options: StartHandOptions,
  ids: IdFactory,
): EngineResult<Hand> {
  const events = buildStartEvents(table, options, ids);
  if (!events.ok) return events;
  return ok(handOf(events.value));
}

/**
 * Result. CONTRACT: never throws for any `HandCommand` value that type-checks.
 * Deliberately does NOT catch invariant throws from the reducer — a rules bug must fail
 * loud, and the web app wraps the table in an error boundary.
 */
export function applyCommand(hand: Hand, command: HandCommand, ids: IdFactory): EngineResult<Hand> {
  const commandSeq = (lastCommandSeq(hand.events) ?? -1) + 1;
  const produced = expandCommand(
    hand.state,
    command,
    { commandSeq, startSeq: hand.events.length },
    ids,
  );
  if (!produced.ok) return produced;
  return ok(handOf([...hand.events, ...produced.value]));
}

/** Result. Short-circuits on the first Err. Test and fixture ergonomics. */
export function applyCommands(
  hand: Hand,
  commands: readonly HandCommand[],
  ids: IdFactory,
): EngineResult<Hand> {
  let current = hand;
  for (let index = 0; index < commands.length; index += 1) {
    const command = commands[index];
    invariant(command !== undefined, `missing command at index ${index}`);
    const next = applyCommand(current, command, ids);
    if (!next.ok) {
      return engineErr(next.error.code, next.error.message, {
        ...next.error.context,
        commandIndex: index,
      });
    }
    current = next.value;
  }
  return ok(current);
}

/**
 * Total. False while only command group 0 remains: undoing the hand start is "discard
 * the hand", a session-level operation, not an in-hand undo.
 */
export function canUndo(hand: Hand): boolean {
  return (lastCommandSeq(hand.events) ?? 0) > 0;
}

/** Total. `commandCount - 1`: how many times `Z` can still be pressed. */
export function undoDepth(hand: Hand): number {
  return Math.max(0, lastCommandSeq(hand.events) ?? 0);
}

/**
 * Result. Drops every event whose `commandSeq` equals the maximum, then re-folds from
 * scratch. No inverse operations, no drift. Never renumbers or regenerates ids on the
 * surviving events, so the log stays byte-identical (ADR-0007).
 */
export function undo(hand: Hand): EngineResult<Hand> {
  const last = lastCommandSeq(hand.events);
  if (last === null || last === 0) {
    return engineErr('NOTHING_TO_UNDO', 'Only the hand start remains; discard the hand instead');
  }
  return ok(handOf(hand.events.filter((event) => event.commandSeq !== last)));
}

/** Internal. Structural log checks shared by both rehydration entry points. */
function checkLogShape(events: readonly HandEvent[]): EngineResult<null> {
  const first = events[0];
  if (first === undefined) {
    return engineErr('CORRUPT_LOG', 'An empty event log cannot be replayed');
  }
  if (first.kind !== 'HAND_STARTED') {
    return engineErr('CORRUPT_LOG', 'The first event must be HAND_STARTED', {
      seq: first.seq,
      eventKind: first.kind,
      expected: 'HAND_STARTED',
    });
  }
  let previousCommandSeq = -1;
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    if (event === undefined) {
      return engineErr('CORRUPT_LOG', `Missing event at index ${index}`, { seq: index });
    }
    if (event.seq !== index) {
      return engineErr('CORRUPT_LOG', `Event seq ${event.seq} is not dense at index ${index}`, {
        seq: event.seq,
        eventKind: event.kind,
      });
    }
    if (event.commandSeq < previousCommandSeq) {
      return engineErr(
        'CORRUPT_LOG',
        `Event commandSeq ${event.commandSeq} decreases at seq ${event.seq}`,
        { seq: event.seq, eventKind: event.kind },
      );
    }
    previousCommandSeq = event.commandSeq;
  }
  return ok(null);
}

/**
 * Result. STRUCTURAL rehydration for the DB: applies the events, asserting only
 * arithmetic identities and chip/pot conservation, never rule-dependent legality.
 * A corrected rule therefore never makes stored history unloadable.
 */
export function loadHand(events: readonly HandEvent[]): EngineResult<Hand> {
  const shape = checkLogShape(events);
  if (!shape.ok) return shape;
  try {
    return ok(handOf(events));
  } catch (error) {
    return engineErr('CORRUPT_LOG', messageOf(error));
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Internal. Events grouped by `commandSeq`, in log order. */
function groupByCommand(events: readonly HandEvent[]): readonly (readonly HandEvent[])[] {
  const groups: HandEvent[][] = [];
  let currentSeq: number | null = null;
  for (const event of events) {
    if (currentSeq === null || event.commandSeq !== currentSeq) {
      groups.push([event]);
      currentSeq = event.commandSeq;
    } else {
      const last = groups[groups.length - 1];
      invariant(last !== undefined, 'group accumulator is empty');
      last.push(event);
    }
  }
  return groups;
}

/** Internal. The command that must have produced this command group. */
function commandForGroup(group: readonly HandEvent[]): EngineResult<HandCommand> {
  const head = group[0];
  if (head === undefined) return engineErr('CORRUPT_LOG', 'Empty command group');
  if (head.origin !== 'USER') {
    return engineErr('CORRUPT_LOG', `Command group starts with an ENGINE ${head.kind}`, {
      seq: head.seq,
      eventKind: head.kind,
    });
  }
  switch (head.kind) {
    case 'FOLD':
    case 'CHECK':
    case 'CALL':
    case 'ALL_IN':
      return ok({ kind: head.kind, seat: head.seat });
    case 'BET':
    case 'RAISE':
      return ok({ kind: head.kind, seat: head.seat, toAmount: head.toAmount });
    case 'HOLE_CARDS_SET':
      return ok({
        kind: 'SET_HOLE_CARDS',
        seat: head.seat,
        cards: head.cards,
        revealed: head.revealed,
      });
    case 'FLOP_DEALT':
      return ok({ kind: 'DEAL_BOARD', cards: head.cards });
    case 'TURN_DEALT':
    case 'RIVER_DEALT':
      return ok({ kind: 'DEAL_BOARD', cards: [head.card] });
    case 'POT_AWARDED': {
      const awards: PotAwardInput[] = [];
      for (const event of group) {
        if (event.kind === 'POT_AWARDED' && event.origin === 'USER') {
          awards.push({ potIndex: event.potIndex, winners: event.winners });
        }
      }
      return ok({ kind: 'AWARD_POTS', awards });
    }
    default:
      return engineErr('CORRUPT_LOG', `${head.kind} cannot start a command group`, {
        seq: head.seq,
        eventKind: head.kind,
      });
  }
}

/** Internal. Key ordering is normalised so two structurally equal payloads compare equal. */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) out[key] = canonical(source[key]);
    return out;
  }
  return value;
}

/** Internal. Everything on an event except its id — ids differ between replays by design. */
function payloadKey(event: HandEvent): string {
  const { id: _id, ...rest } = event;
  return JSON.stringify(canonical(rest));
}

function samePayloads(a: readonly HandEvent[], b: readonly HandEvent[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((event, index) => {
    const other = b[index];
    return other !== undefined && payloadKey(event) === payloadKey(other);
  });
}

/** Internal. Strict rehydration replays through the command layer with throwaway ids. */
function replayIds(): IdFactory {
  let counter = 0;
  return { next: () => `replay-${(counter += 1)}` };
}

/**
 * Result. STRICT rehydration: every action event is re-validated as if it were the
 * corresponding command, and every engine event must be one the state actually owed.
 * This is the round-trip guarantee Phase 11 needs.
 */
export function replayHand(events: readonly HandEvent[]): EngineResult<Hand> {
  const shape = checkLogShape(events);
  if (!shape.ok) return shape;
  const groups = groupByCommand(events);
  const startGroup = groups[0];
  if (startGroup === undefined) return engineErr('CORRUPT_LOG', 'An empty log cannot be replayed');

  const started = startGroup[0];
  if (started === undefined || started.kind !== 'HAND_STARTED') {
    return engineErr('CORRUPT_LOG', 'The first command group must open with HAND_STARTED');
  }

  const roster: RosterEntry[] = [];
  for (const event of startGroup) {
    if (event.kind === 'PLAYER_DEALT_IN') {
      roster.push({
        seat: event.seat,
        playerId: event.playerId,
        startingStack: event.startingStack,
      });
    }
  }

  const ids = replayIds();
  try {
    const rebuiltStart = composeStartEvents(
      {
        handId: started.handId,
        handNumber: started.handNumber,
        config: started.config,
        buttonSeat: started.buttonSeat,
        heroSeat: started.heroSeat,
        roster,
      },
      ids,
    );
    if (!rebuiltStart.ok) {
      return engineErr(
        'CORRUPT_LOG',
        `The hand start is not replayable: ${rebuiltStart.error.message}`,
        {
          seq: 0,
          eventKind: 'HAND_STARTED',
        },
      );
    }
    if (!samePayloads(startGroup, rebuiltStart.value)) {
      return engineErr('CORRUPT_LOG', 'The hand-start command group does not match the engine', {
        seq: 0,
        eventKind: 'HAND_STARTED',
      });
    }

    let state = foldEvents(rebuiltStart.value);
    let seq = rebuiltStart.value.length;
    for (let index = 1; index < groups.length; index += 1) {
      const group = groups[index];
      invariant(group !== undefined, `missing command group ${index}`);
      const head = group[0];
      invariant(head !== undefined, `empty command group ${index}`);
      const command = commandForGroup(group);
      if (!command.ok) return command;
      const legal = validateCommand(state, command.value);
      if (!legal.ok) {
        return engineErr(
          'CORRUPT_LOG',
          `Event ${head.seq} (${head.kind}) is not legal on replay: ${legal.error.message}`,
          {
            seq: head.seq,
            eventKind: head.kind,
          },
        );
      }
      const rebuilt = expandCommand(
        state,
        command.value,
        { commandSeq: head.commandSeq, startSeq: seq },
        ids,
      );
      if (!rebuilt.ok) {
        return engineErr('CORRUPT_LOG', `Event ${head.seq} (${head.kind}) is not replayable`, {
          seq: head.seq,
          eventKind: head.kind,
        });
      }
      if (!samePayloads(group, rebuilt.value)) {
        return engineErr(
          'CORRUPT_LOG',
          `Command group at seq ${head.seq} does not match what the engine derives`,
          { seq: head.seq, eventKind: head.kind },
        );
      }
      seq += rebuilt.value.length;
      state = foldEvents(events.slice(0, seq));
    }
    if (seq !== events.length) {
      return engineErr('CORRUPT_LOG', 'The log has trailing events the engine did not derive', {
        seq,
      });
    }
    return ok({ events, state });
  } catch (error) {
    return engineErr('CORRUPT_LOG', messageOf(error));
  }
}

/**
 * Result. State at any command boundary — time travel for the replay UI, and the natural
 * place a UI-level redo stack keeps the dropped tail.
 */
export function handAtCommand(hand: Hand, commandSeq: number): EngineResult<Hand> {
  const max = lastCommandSeq(hand.events) ?? 0;
  if (!Number.isInteger(commandSeq) || commandSeq < 0 || commandSeq > max) {
    return engineErr(
      'CORRUPT_LOG',
      `There is no command boundary ${commandSeq}; the hand has groups 0..${max}`,
      { seq: commandSeq },
    );
  }
  return ok(handOf(hand.events.filter((event) => event.commandSeq <= commandSeq)));
}

/**
 * Result. A whole hand as a command list, with the failing command's index reported in
 * `error.context.commandIndex`. The Phase 11 parser's and the test suite's main entry point.
 */
export function replayCommands(
  table: TableState,
  options: StartHandOptions,
  commands: readonly HandCommand[],
  ids: IdFactory,
): EngineResult<Hand> {
  const start = startHand(table, options, ids);
  if (!start.ok) return start;
  return applyCommands(start.value, commands, ids);
}
