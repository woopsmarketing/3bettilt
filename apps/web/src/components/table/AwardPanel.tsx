'use client';

/**
 * The minimum manual award panel — what a contested hand needs to reach `COMPLETE`.
 *
 * An all-folded hand never gets here: `commands.ts`'s cascade awards an uncontested pot
 * itself and emits `HAND_FINISHED`. This panel exists for the other case, a showdown,
 * where the engine deliberately refuses to guess a winner.
 *
 * Four rules hold in this file:
 *
 * 1. **No hand evaluator, no suggestion, no "likely winner".** The user picks; the engine
 *    validates. Nothing here reads a hole card or a board card.
 * 2. **No money is computed.** `amount`, `projectedRake` and `projectedFee` are printed
 *    exactly as `AwardablePot` reports them (`CLAUDE.md` rule 1, `prompt` D2). Rake and fee
 *    are engine policy (ADR-0018/0032); this panel has no opinion about either.
 * 3. **Rejections are surfaced, not pre-empted.** `NO_WINNERS`, `WINNER_NOT_ELIGIBLE`,
 *    `AWARDS_INCOMPLETE` and the rest come back from `applyCommand` and are rendered by the
 *    table's error banner. The submit button does not re-implement those checks.
 * 4. **One command covers every unawarded pot**, because the per-hand rake cap is computed
 *    once across them (`settlement.ts`).
 * 5. **A selection cannot outlive the hand it was made for.** Pot indexes repeat — every
 *    hand has a main pot 0 — so the ticked winners are held in a session keyed by the
 *    hand, exactly as `CardPalette.tsx` keys its picks by the card-entry request. A key
 *    that no longer matches reads as an empty selection, so hand N's winner can never be
 *    submitted for hand N+1.
 */
import { useState } from 'react';
import { Money } from '@gto-self/shared';
import type { MilliBB } from '@gto-self/shared';
import type { AwardablePot, HandView, SeatIndex } from '@gto-self/poker-core';
import { useTableStore } from './TableStoreProvider.js';

const bb = (amount: MilliBB): string => Money.formatBB(amount, { maxDecimals: 3, unit: true });

/** The winners ticked for ONE hand. `key` is what stops the selection outliving it. */
interface AwardSession {
  readonly key: string | null;
  readonly winners: Readonly<Record<number, readonly SeatIndex[]>>;
}

const EMPTY_SESSION: AwardSession = { key: null, winners: {} };

export interface AwardPanelProps {
  readonly view: HandView | null;
}

export function AwardPanel({ view }: AwardPanelProps) {
  const apply = useTableStore((state) => state.apply);
  /** Winners the user has ticked, per pot index. Selection only — never a poker fact. */
  const [session, setSession] = useState<AwardSession>(EMPTY_SESSION);

  if (view === null || view.phase.kind !== 'AWAITING_AWARD') return null;
  const pending = view.phase.pots.filter((pot) => !pot.awarded);
  if (pending.length === 0) return null;

  // One key per hand. Pot indexes restart at 0 every hand, so without this a tick made in
  // hand N would still be ticked — and still be submitted — in hand N+1.
  const key = `${view.handNumber}:AWARD`;
  const live = session.key === key ? session : EMPTY_SESSION;
  const winners = live.winners;

  const toggle = (pot: AwardablePot, seat: SeatIndex): void => {
    const current = winners[pot.index] ?? [];
    const next = current.includes(seat)
      ? current.filter((candidate) => candidate !== seat)
      : [...current, seat];
    setSession({ key, winners: { ...winners, [pot.index]: next } });
  };

  const submit = (): void => {
    apply({
      kind: 'AWARD_POTS',
      awards: pending.map((pot) => ({ potIndex: pot.index, winners: winners[pot.index] ?? [] })),
      // No fee: a splash fee has no automatic trigger and none was observed (ADR-0032).
      fee: null,
    });
  };

  return (
    <section
      data-testid="award-panel"
      aria-label="Award pots"
      className="flex flex-col gap-2 border-t border-surface-700 bg-surface-900 px-4 py-2 text-[0.7rem]"
    >
      <div className="flex items-center gap-3">
        <span className="uppercase tracking-widest text-ink-500">award</span>
        <span className="text-ink-300">
          Pick the winner of each pot. The engine settles it — no hand is evaluated here.
        </span>
      </div>

      {pending.map((pot) => (
        <div
          key={pot.index}
          data-testid={`award-pot-${pot.index}`}
          className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-surface-700 bg-surface-800 px-3 py-2"
        >
          <span className="uppercase tracking-wide text-ink-500">
            {pot.kind === 'MAIN' ? 'main pot' : `side pot ${pot.index}`}
          </span>
          <span className="tabular text-ink-100" data-testid={`award-amount-${pot.index}`}>
            {bb(pot.amount)}
          </span>
          <span className="tabular text-ink-500" data-testid={`award-rake-${pot.index}`}>
            rake {bb(pot.projectedRake)}
          </span>
          <span className="tabular text-ink-500" data-testid={`award-fee-${pot.index}`}>
            fee {bb(pot.projectedFee)}
          </span>
          <span className="flex items-center gap-1">
            {pot.eligibleSeats.map((seat) => {
              const chosen = (winners[pot.index] ?? []).includes(seat);
              return (
                <button
                  key={seat}
                  type="button"
                  data-testid={`award-seat-${pot.index}-${seat}`}
                  aria-pressed={chosen}
                  onClick={() => toggle(pot, seat)}
                  className={`rounded border px-2 py-0.5 ${
                    chosen
                      ? 'border-good-500 text-good-500'
                      : 'border-surface-600 text-ink-300 hover:border-actor-500'
                  }`}
                >
                  seat {seat + 1}
                </button>
              );
            })}
          </span>
        </div>
      ))}

      <button
        type="button"
        data-testid="award-submit"
        onClick={submit}
        className="self-start rounded-md border border-good-500 px-3 py-1 text-xs font-semibold text-good-500"
      >
        Award pots
      </button>
    </section>
  );
}
