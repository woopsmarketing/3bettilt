'use client';

/**
 * The completed-hand persistence trigger (ADR-0059c/e).
 *
 * ## Where it fires
 *
 * Exactly on the transition into `HandState.phase === 'COMPLETE'` — the award is submitted,
 * `HAND_FINISHED` is folded into the state, and nothing can happen to this hand again. That
 * is the completion boundary the store already uses (`canStartHand`), and the one ADR-0059b
 * fixes as the write point.
 *
 * It is an EFFECT, not part of the transition: `apply` has already returned and React has
 * already rendered by the time this runs, and the call itself is unawaited. Nothing between a
 * keypress and a visible change ever waits on the database (ADR-0043), and Start Hand stays
 * available while a save is still in flight.
 *
 * ## Exactly once, from this side too
 *
 * The database is the authority (ADR-0059d — `hands.id` is the engine's own `handId`), so a
 * duplicate is never a *correctness* problem; it is a wasted round trip and a confusing
 * banner. This module still refuses to make one:
 *
 *  - one entry per `handId`, in a ref-held registry that survives every re-render;
 *  - a `PENDING -> IN_FLIGHT -> SAVED | FAILED` status on that entry, checked before every
 *    dispatch — so a React Strict Mode double effect, a re-render, a repeated Next Hand and a
 *    retry racing an in-flight request all collapse to the one request already running;
 *  - `SAVED` is terminal: nothing re-fires a hand that is stored.
 *
 * `ALREADY_PERSISTED` is treated as success, because it means precisely "the database
 * already holds this hand".
 *
 * ## When it fails
 *
 * The in-memory hand is NOT touched and the table is NOT blocked — the user may deal the next
 * hand immediately. The failure is shown (`CLAUDE.md` rule 5, `prompt` §10) with a retry that
 * re-fires the SAME encoded log, which is kept in the registry until it saves. The residual
 * risk is stated in the report: closing the page discards a never-saved hand, which is what
 * ADR-0059 accepts for this milestone.
 *
 * ## What travels
 *
 * `encodeHandEvents(hand.events)` — the log after any undo, and nothing derived. The server
 * decodes and re-folds it; no state this browser computed is stored.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { encodeHandEvents } from '@gto-self/poker-core';
import type { Hand } from '@gto-self/poker-core';
import type {
  PersistCompletedHandAction,
  PersistCompletedHandValue,
} from '../../lib/table/history-contract.js';

/** One completed hand that is not stored. Shown until it saves; never silently dropped. */
export interface HandSaveFailure {
  readonly handId: string;
  /** The hand's own number, which is what the user sees in the header. */
  readonly handNumber: number;
  /** The server's own code and message, verbatim (`CLAUDE.md` rule 3). */
  readonly detail: string;
}

type SaveStatus = 'PENDING' | 'IN_FLIGHT' | 'SAVED' | 'FAILED';

interface SaveEntry {
  readonly handId: string;
  readonly handNumber: number;
  /** The encoded log, kept so a retry re-sends exactly what completion produced. */
  readonly input: PersistCompletedHandValue;
  status: SaveStatus;
}

export interface CompletedHandSaves {
  /** Every completed hand this mount could not store, newest last. */
  readonly failures: readonly HandSaveFailure[];
  /** Re-fire one failed save. A no-op for a hand that is stored or already in flight. */
  readonly retry: (handId: string) => void;
  /**
   * Durably stored hands for this session: what the page loaded with, plus what this mount
   * has saved. `null` when the load-time count itself could not be read.
   */
  readonly storedHandCount: number | null;
  /**
   * Completed hands whose persist has been sent and not yet answered.
   *
   * It exists for ONE consumer: the 세션 분석 및 반영 safe boundary (prompt §26). A run started
   * while a save is still travelling would read a session hand count one short of what the
   * user just played and report it as fact, so the button waits for this to reach zero.
   * Nothing else reads it and nothing about the hand path depends on it.
   */
  readonly savesInFlight: number;
}

export interface CompletedHandSavesInput {
  readonly sessionId: string;
  /** The store's live hand. `null` before the first deal. */
  readonly hand: Hand | null;
  /**
   * The server action. Optional: without it a hand is simply not persisted, exactly as the
   * other table-side actions behave, so a component test can render without a server.
   */
  readonly persist?: PersistCompletedHandAction;
  /** The count read on the server at page load, or `null` when it could not be read. */
  readonly loadedHandCount?: number | null;
}

export function useCompletedHandSaves(input: CompletedHandSavesInput): CompletedHandSaves {
  const { sessionId, hand, persist, loadedHandCount = null } = input;

  // Refs, not state: nothing renders from either, and both must be readable by a callback
  // that closed over an older render (the same reason the per-seat save sequence is a ref).
  // Lazily created (`x.current ??= …`, the same idiom `TableStoreProvider` uses) so a render
  // on the action path does not allocate a map it will throw away.
  const entriesRef = useRef<Map<string, SaveEntry> | null>(null);
  entriesRef.current ??= new Map();
  const entries = entriesRef.current;
  /** When each hand was DEALT, by hand id. Taken the first time the hand is seen. */
  const startedAtRef = useRef<Map<string, number> | null>(null);
  startedAtRef.current ??= new Map();
  const startedAt = startedAtRef.current;

  const [failures, setFailures] = useState<readonly HandSaveFailure[]>([]);
  /** Hands stored by THIS mount. Counted once each, when the save first succeeds. */
  const [savedHere, setSavedHere] = useState(0);
  /**
   * Requests sent and not yet answered. State rather than a ref because the analysis button
   * renders from it; incremented exactly where `status` becomes `IN_FLIGHT` and decremented
   * on BOTH settle paths, so it cannot be left above zero by a rejection.
   */
  const [savesInFlight, setSavesInFlight] = useState(0);

  const fire = useCallback(
    (entry: SaveEntry): void => {
      if (persist === undefined) return;
      // The whole exactly-once guard, in one place: an in-flight request is already doing
      // this, and a stored hand is done forever.
      if (entry.status === 'IN_FLIGHT' || entry.status === 'SAVED') return;
      entry.status = 'IN_FLIGHT';
      setSavesInFlight((count) => count + 1);
      setFailures((current) => current.filter((failure) => failure.handId !== entry.handId));

      const noteFailure = (detail: string): void => {
        entry.status = 'FAILED';
        setFailures((current) =>
          current.some((failure) => failure.handId === entry.handId)
            ? current
            : [...current, { handId: entry.handId, handNumber: entry.handNumber, detail }],
        );
      };

      void persist(entry.input)
        .then((result) => {
          if (result.ok) {
            entry.status = 'SAVED';
            setSavedHere((count) => count + 1);
            setFailures((current) => current.filter((failure) => failure.handId !== entry.handId));
            return;
          }
          noteFailure(`${result.code}: ${result.message}`);
        })
        .catch((error: unknown) => {
          noteFailure(error instanceof Error ? error.message : String(error));
        })
        .finally(() => setSavesInFlight((count) => count - 1));
    },
    [persist],
  );

  useEffect(() => {
    if (hand === null) return;
    const handId = hand.state.handId;
    // The hand's OWN start, captured the first time this mount sees it — not the moment it
    // completed, and not the moment the server received it.
    if (!startedAt.has(handId)) startedAt.set(handId, Date.now());
    if (hand.state.phase !== 'COMPLETE') return;

    let entry = entries.get(handId);
    if (entry === undefined) {
      entry = {
        handId,
        handNumber: hand.state.handNumber,
        input: {
          sessionId,
          events: encodeHandEvents(hand.events),
          startedAt: startedAt.get(handId) ?? Date.now(),
          finishedAt: Date.now(),
        },
        status: 'PENDING',
      };
      entries.set(handId, entry);
    }
    fire(entry);
  }, [hand, sessionId, fire, entries, startedAt]);

  const retry = useCallback(
    (handId: string): void => {
      const entry = entries.get(handId);
      if (entry === undefined) return;
      fire(entry);
    },
    [fire, entries],
  );

  return {
    failures,
    retry,
    storedHandCount: loadedHandCount === null ? null : loadedHandCount + savedHere,
    savesInFlight,
  };
}
