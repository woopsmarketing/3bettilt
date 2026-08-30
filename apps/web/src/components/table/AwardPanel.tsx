'use client';

/**
 * The manual award panel — what a contested hand needs to reach `COMPLETE`, plus the
 * optional record of what each player showed.
 *
 * An all-folded hand never gets here: `commands.ts`'s cascade awards an uncontested pot
 * itself and emits `HAND_FINISHED`. This panel exists for the other case, a showdown,
 * where the engine deliberately refuses to guess a winner.
 *
 * Six rules hold in this file:
 *
 * 1. **No hand evaluator, no suggestion, no "likely winner".** The user picks; the engine
 *    validates. Nothing here reads a hole card or a board card to decide anything — the
 *    reveal row DISPLAYS `view.seats[seat].holeCards` and never judges them.
 * 2. **No money is computed.** `amount`, `projectedRake` and `projectedFee` are printed
 *    exactly as `AwardablePot` reports them (`CLAUDE.md` rule 1, `prompt` D2). A split
 *    says how many ways it goes, never what each share is: the shares (odd milliBB
 *    included) are `settlement.ts`'s to compute. Rake and fee are engine policy
 *    (ADR-0018/0032); this panel has no opinion about either.
 * 3. **Only the user's own selection is pre-checked.** Submit is disabled until every
 *    pending pot has at least one ticked winner, because dispatching a command that is
 *    known to be `NO_WINNERS` just to read the rejection back is not a way to ask a
 *    question. Every POKER judgement stays the engine's: `WINNER_NOT_ELIGIBLE`,
 *    `DUPLICATE_WINNER`, `POT_ALREADY_AWARDED`, `AWARDS_INCOMPLETE` and the rest come back
 *    from `applyCommand` and are rendered by the table's error banner.
 * 4. **One command covers every unawarded pot**, because the per-hand rake cap is computed
 *    once across them (`settlement.ts`).
 * 5. **A selection cannot outlive the hand it was made for.** Pot indexes repeat — every
 *    hand has a main pot 0 — so the ticked winners, the split arming and the muck marks
 *    are held in a session keyed by the hand, exactly as `CardPalette.tsx` keys its picks
 *    by the card-entry request. A key that no longer matches reads as an empty selection,
 *    so hand N's winner can never be submitted for hand N+1.
 * 6. **A split is deliberate.** Clicking a candidate REPLACES the pot's winner — the
 *    common case is one click, and a misclick costs nothing but a second click. Two
 *    winners are reachable only through the pot's own split control, which arms
 *    multi-select; turning it back off collapses to the first ticked seat, so leaving
 *    split mode can never leave a silent split behind.
 *
 * `MUCK` is local UI state and nothing else. It records "this player did not show", which
 * is genuinely unknown information: it fabricates no cards, dispatches no command, and
 * there is no `poker-core` event for it. Like everything else at this table in Alpha it is
 * NOT persisted — a reload discards it (ADR-0043) — and it never restricts who may be
 * awarded a pot: a muck mark only stops the panel asking that seat for cards.
 */
import { useState } from 'react';
import { Money } from '@gto-self/shared';
import type { MilliBB } from '@gto-self/shared';
import type { AwardablePot, HandView, SeatIndex } from '@gto-self/poker-core';
import { CardChip } from './CardChip.js';
import { POSITION_LABEL, seatLabel } from '../../lib/table/copy.js';
import { useTableStore } from './TableStoreProvider.js';

const bb = (amount: MilliBB): string => Money.formatBB(amount, { maxDecimals: 3, unit: true });

/** One pot's pending selection. `split` is the explicit multi-select arming. */
interface PotSelection {
  readonly winners: readonly SeatIndex[];
  readonly split: boolean;
}

/** Everything ticked for ONE hand. `key` is what stops any of it outliving that hand. */
interface AwardSession {
  readonly key: string | null;
  readonly pots: Readonly<Record<number, PotSelection>>;
  /** Seats the user marked "did not show". UI only — see the file header. */
  readonly mucked: readonly SeatIndex[];
}

const EMPTY_SELECTION: PotSelection = { winners: [], split: false };
const EMPTY_SESSION: AwardSession = { key: null, pots: {}, mucked: [] };

export interface AwardPanelProps {
  readonly view: HandView | null;
  /** The seat's stored nickname, or `null`. Supplied by `TableRoot`; never looked up here. */
  readonly nicknameForSeat: (seat: SeatIndex) => string | null;
  /** The seat the card palette is currently asking to reveal. Owned by `TableRoot`. */
  readonly revealSeat: SeatIndex | null;
  /** Ask the palette for that seat's shown cards; `null` cancels. Dispatches nothing. */
  readonly onRevealSeat: (seat: SeatIndex | null) => void;
}

export function AwardPanel({ view, nicknameForSeat, revealSeat, onRevealSeat }: AwardPanelProps) {
  const apply = useTableStore((state) => state.apply);
  /** What the user has ticked. Selection only — never a poker fact. */
  const [session, setSession] = useState<AwardSession>(EMPTY_SESSION);

  if (view === null || view.phase.kind !== 'AWAITING_AWARD') return null;
  const pending = view.phase.pots.filter((pot) => !pot.awarded);
  if (pending.length === 0) return null;

  // One key per hand. Pot indexes restart at 0 every hand, so without this a tick made in
  // hand N would still be ticked — and still be submitted — in hand N+1.
  const key = `${view.handNumber}:AWARD`;
  const live = session.key === key ? session : EMPTY_SESSION;

  const selectionFor = (potIndex: number): PotSelection => live.pots[potIndex] ?? EMPTY_SELECTION;

  const write = (
    pots: Readonly<Record<number, PotSelection>>,
    mucked: readonly SeatIndex[],
  ): void => setSession({ key, pots, mucked });

  const setSelection = (potIndex: number, next: PotSelection): void =>
    write({ ...live.pots, [potIndex]: next }, live.mucked);

  /** Rule 6. Without `split` armed this REPLACES; with it armed it toggles membership. */
  const chooseWinner = (pot: AwardablePot, seat: SeatIndex): void => {
    const current = selectionFor(pot.index);
    if (!current.split) {
      setSelection(pot.index, { winners: [seat], split: false });
      return;
    }
    setSelection(pot.index, {
      winners: current.winners.includes(seat)
        ? current.winners.filter((candidate) => candidate !== seat)
        : [...current.winners, seat],
      split: true,
    });
  };

  const toggleSplit = (pot: AwardablePot): void => {
    const current = selectionFor(pot.index);
    setSelection(pot.index, {
      // Turning split OFF keeps the first ticked seat only: the panel must never be left
      // splitting a pot the user has stopped asking to split.
      winners: current.split ? current.winners.slice(0, 1) : current.winners,
      split: !current.split,
    });
  };

  const setMucked = (seat: SeatIndex, mucked: boolean): void => {
    write(
      live.pots,
      mucked ? [...live.mucked, seat] : live.mucked.filter((candidate) => candidate !== seat),
    );
    // A seat that did not show is not a seat to ask for cards.
    if (mucked && revealSeat === seat) onRevealSeat(null);
  };

  /** Rule 3: the ONE pre-check, and it is about the user's own selection, not poker. */
  const ready = pending.every((pot) => selectionFor(pot.index).winners.length > 0);

  const submit = (): void => {
    if (!ready) return;
    apply({
      kind: 'AWARD_POTS',
      awards: pending.map((pot) => ({
        potIndex: pot.index,
        winners: selectionFor(pot.index).winners,
      })),
      // No fee: a splash fee has no automatic trigger and none was observed (ADR-0032).
      fee: null,
    });
  };

  /**
   * Presentation only. The nickname is a prop and the position is `SeatView.position`
   * verbatim — neither is derived here (`prompt` D2).
   */
  const describeSeat = (seat: SeatIndex): string => {
    const nickname = nicknameForSeat(seat);
    const position = view.seats[seat].position;
    const parts = [nickname ?? seatLabel(seat)];
    if (position !== null) parts.push(POSITION_LABEL[position]);
    if (nickname !== null) parts.push(seatLabel(seat));
    return parts.join(' · ');
  };

  const potLabel = (pot: AwardablePot): string =>
    pot.kind === 'MAIN' ? '메인 팟' : `사이드 팟 ${pot.index}`;

  const summaryFor = (pot: AwardablePot): string => {
    const winners = selectionFor(pot.index).winners;
    const only = winners[0];
    if (only === undefined) return '승자 미선택';
    if (winners.length === 1) return `전부 ${describeSeat(only)}`;
    return `${winners.length}명 분할 — ${winners.map(describeSeat).join(' / ')}`;
  };

  return (
    <section
      data-testid="award-panel"
      aria-label="팟 정산"
      className="flex min-w-0 flex-1 flex-col gap-1 text-[0.7rem]"
    >
      <div className="flex items-center gap-3">
        <span className="uppercase tracking-widest text-ink-500">정산</span>
        <span className="text-ink-300">
          각 팟의 승자를 고르세요. 족보 판정은 하지 않고, 정산은 엔진이 합니다.
        </span>
      </div>

      {/*
        Showdown reveal. `view.contenderSeats` is the engine's own showdown set; this panel
        does not work out who is still in the hand. Entirely optional: a pot can be awarded
        with nobody having shown.
      */}
      <div
        data-testid="award-reveal"
        className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-surface-700 bg-surface-800 px-2 py-1"
      >
        <span className="uppercase tracking-wide text-ink-500">쇼다운</span>
        <span className="text-ink-500">선택 — 기록하지 않아도 됩니다</span>
        {view.contenderSeats.map((seat) => {
          const cards = view.seats[seat].holeCards;
          // Two cards is a known hand: it is rendered, and the seat is not asked again.
          const known = cards.length >= 2;
          const mucked = live.mucked.includes(seat);
          return (
            <span
              key={seat}
              data-testid={`award-reveal-${seat}`}
              className="flex items-center gap-1 rounded border border-surface-700 px-2 py-0.5"
            >
              <span className="text-ink-300">{describeSeat(seat)}</span>
              {cards.length > 0 && (
                <span data-testid={`award-shown-${seat}`} className="flex items-center gap-1">
                  {cards.map((card) => (
                    <CardChip key={card} card={card} size="sm" />
                  ))}
                </span>
              )}
              {!known &&
                (mucked ? (
                  <>
                    <span data-testid={`award-notshown-${seat}`} className="text-ink-500">
                      오픈 안 함
                    </span>
                    <button
                      type="button"
                      data-testid={`award-unmuck-${seat}`}
                      onClick={() => setMucked(seat, false)}
                      className="rounded border border-surface-600 px-1.5 py-0.5 text-ink-300 hover:border-actor-500"
                    >
                      다시 묻기
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      data-testid={`award-show-${seat}`}
                      aria-pressed={revealSeat === seat}
                      onClick={() => onRevealSeat(seat)}
                      className={`rounded border px-1.5 py-0.5 ${
                        revealSeat === seat
                          ? 'border-actor-500 text-actor-500'
                          : 'border-surface-600 text-ink-300 hover:border-actor-500'
                      }`}
                    >
                      오픈
                    </button>
                    <button
                      type="button"
                      data-testid={`award-muck-${seat}`}
                      onClick={() => setMucked(seat, true)}
                      className="rounded border border-surface-600 px-1.5 py-0.5 text-ink-300 hover:border-actor-500"
                    >
                      머크
                    </button>
                  </>
                ))}
            </span>
          );
        })}
      </div>

      {pending.map((pot) => {
        const selection = selectionFor(pot.index);
        return (
          <div
            key={pot.index}
            data-testid={`award-pot-${pot.index}`}
            data-split={selection.split ? 'true' : 'false'}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-surface-700 bg-surface-800 px-2 py-1"
          >
            <span className="uppercase tracking-wide text-ink-500">{potLabel(pot)}</span>
            <span className="tabular text-ink-100" data-testid={`award-amount-${pot.index}`}>
              {bb(pot.amount)}
            </span>
            <span className="tabular text-ink-500" data-testid={`award-rake-${pot.index}`}>
              레이크 {bb(pot.projectedRake)}
            </span>
            <span className="tabular text-ink-500" data-testid={`award-fee-${pot.index}`}>
              피 {bb(pot.projectedFee)}
            </span>
            <button
              type="button"
              data-testid={`award-split-${pot.index}`}
              aria-pressed={selection.split}
              onClick={() => toggleSplit(pot)}
              className={`rounded border px-2 py-0.5 ${
                selection.split
                  ? 'border-dirty-500 text-dirty-500'
                  : 'border-surface-600 text-ink-500 hover:border-dirty-500'
              }`}
            >
              {selection.split ? '분할 중 — 단독 승자로' : '팟 분할'}
            </button>
            <span className="flex flex-wrap items-center gap-1">
              {pot.eligibleSeats.map((seat) => {
                const chosen = selection.winners.includes(seat);
                return (
                  <button
                    key={seat}
                    type="button"
                    data-testid={`award-seat-${pot.index}-${seat}`}
                    aria-pressed={chosen}
                    onClick={() => chooseWinner(pot, seat)}
                    className={`rounded border px-2 py-0.5 ${
                      chosen
                        ? 'border-good-500 text-good-500'
                        : 'border-surface-600 text-ink-300 hover:border-actor-500'
                    }`}
                  >
                    {describeSeat(seat)}
                  </button>
                );
              })}
            </span>
          </div>
        );
      })}

      {/* What pressing the button will actually do, in words, before it is pressed. */}
      <ul data-testid="award-summary" className="flex flex-col gap-0.5">
        {pending.map((pot) => {
          const selection = selectionFor(pot.index);
          const isSplit = selection.winners.length > 1;
          return (
            <li
              key={pot.index}
              data-testid={`award-summary-${pot.index}`}
              data-split={isSplit ? 'true' : 'false'}
              className={isSplit ? 'font-semibold text-dirty-500' : 'text-ink-300'}
            >
              {isSplit && <span className="mr-1 rounded border border-dirty-500 px-1">분할</span>}
              {potLabel(pot)} {bb(pot.amount)} — {summaryFor(pot)}
            </li>
          );
        })}
      </ul>

      <div className="flex items-center gap-3">
        <button
          type="button"
          data-testid="award-submit"
          disabled={!ready}
          onClick={submit}
          className="self-start rounded-md border border-good-500 px-3 py-1 text-xs font-semibold text-good-500 disabled:border-surface-600 disabled:text-ink-700"
        >
          팟 정산
        </button>
        {!ready && (
          <span data-testid="award-blocked" className="text-ink-500">
            모든 팟의 승자를 먼저 고르세요.
          </span>
        )}
      </div>
    </section>
  );
}
