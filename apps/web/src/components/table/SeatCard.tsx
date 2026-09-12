'use client';

/**
 * One physical seat. It never moves: `docs/UX.md` pins hero bottom-centre and rotates the
 * MARKERS instead.
 *
 * Every poker fact on this card is a field read off `SeatView`, which came from
 * `toView(hand)`. Nothing here decides who the button is, what a position is called, who
 * is on the clock, or what anything costs (`prompt` D2). With no hand in progress there
 * is no `SeatView`, and the card falls back to the stored `TableSeat` — occupancy, stack
 * and the table's own hero/button fields, which are stored values, not derived ones.
 *
 * Copy is Korean; `BTN` / `SB` / `BB` and the position labels are international poker
 * vocabulary and stay Latin (`lib/table/copy.ts`).
 *
 * ## Why the root is a `div[role=button]` and no longer a `<button>`
 *
 * WP-5 puts the stack resync ON the number: clicking the stack turns it into an input, in
 * place, so four or five seats can be corrected in seconds without opening anything. A
 * `<button>` may contain neither a button nor an input, so the card's root became a
 * `div[role=button]` with the same click behaviour, the same `data-testid` and the same
 * `data-*` attributes. Keyboard activation is handled explicitly and ONLY when the event
 * targets the card itself, so typing in the stack field never also selects the seat.
 *
 * A native `<button>` gets `Enter`/`Space` activation from the platform; this one gets it from
 * the `onKeyDown` below, and a regression there would be invisible to every mouse-driven test
 * in the suite. So the selection is exposed as `data-selected` and `TableRoot.test.tsx` presses
 * both keys against it — a class name is not a contract, and asserting a border colour to prove
 * a keyboard works is not an assertion about the keyboard.
 *
 * Known limitation, out of scope here: the card is an interactive element containing other
 * interactive elements (the stack field, the chips), which ARIA does not sanction. The nesting
 * predates this note and is recorded rather than silently accepted.
 *
 * The stack editor is CONTROLLED by the caller (`stackEditing`), because Enter has to hand
 * focus to the NEXT dirty seat — a decision only something that can see every seat can make
 * (`tableStore.nextDirtySeat`). This component owns the text and the refusal, never the
 * choice of which seat is being edited.
 */
import { useEffect, useRef, useState } from 'react';
import { Money } from '@gto-self/shared';
import type { MilliBB } from '@gto-self/shared';
import type { SeatIndex, SeatView, TableSeat } from '@gto-self/poker-core';
import type { ActionRecord } from '@gto-self/poker-core';
import {
  ACTION_LABEL,
  POSITION_LABEL,
  SEAT_DIRTY_BADGE,
  SEAT_OCCUPANCY_LABEL,
  SEAT_STATUS_LABEL,
  STACK_EDIT_LABEL,
  STACK_EDIT_REJECTION_LABEL,
  seatLabel,
  type StackEditRejection,
} from '../../lib/table/copy.js';

export interface SeatCardProps {
  readonly seat: SeatIndex;
  readonly tableSeat: TableSeat;
  /** `null` while no hand is live. */
  readonly view: SeatView | null;
  readonly nickname: string | null;
  /** From `table.heroSeat`; used only when there is no hand to read `isHero` from. */
  readonly heroSeat: SeatIndex | null;
  /** From `table.buttonSeat`; used only when there is no hand. */
  readonly tableButtonSeat: SeatIndex | null;
  readonly selected: boolean;
  readonly onSelect: (seat: SeatIndex) => void;
  /** `tableStore.dirtySeats`: this seat's stack was never observed (WP-4/WP-5). */
  readonly dirty?: boolean;
  /** True while THIS seat is the one whose stack the user is typing. Caller-controlled. */
  readonly stackEditing?: boolean;
  readonly onBeginStackEdit?: (seat: SeatIndex) => void;
  readonly onCancelStackEdit?: () => void;
  /** Called with an ALREADY-VALIDATED positive integer milliBB. */
  readonly onCommitStack?: (seat: SeatIndex, stack: MilliBB) => void;
}

/**
 * Presentation only: how one `ActionRecord` reads in the seat's footer. The verb comes
 * from the exhaustive `ACTION_LABEL` map, so a new engine event cannot render untranslated.
 */
function lastActionLabel(record: ActionRecord): string {
  const verb = ACTION_LABEL[record.kind];
  if (record.toAmount === null) return verb;
  return `${verb} ${Money.formatBB(record.toAmount, { maxDecimals: 3 })}`;
}

/**
 * The client's own refusal, deliberately IDENTICAL to the one `correctSeatStack` and the
 * server both make (`tableStore.correctSeatStack`): unparseable text, and a value that is not
 * strictly positive. A client that accepted what the store rejects is how the earlier
 * auto-top-up MAJOR happened; the entered text is never discarded either way (rule 3).
 */
function parseStackText(text: string): { readonly ok: true; readonly value: MilliBB } | {
  readonly ok: false;
  readonly rejection: StackEditRejection;
} {
  const parsed = Money.parseBB(text);
  if (!parsed.ok) return { ok: false, rejection: 'NOT_A_NUMBER' };
  if (!Money.isPositive(parsed.value)) return { ok: false, rejection: 'NOT_POSITIVE' };
  return { ok: true, value: parsed.value };
}

export function SeatCard({
  seat,
  tableSeat,
  view,
  nickname,
  heroSeat,
  tableButtonSeat,
  selected,
  onSelect,
  dirty = false,
  stackEditing = false,
  onBeginStackEdit,
  onCancelStackEdit,
  onCommitStack,
}: SeatCardProps) {
  const empty = tableSeat.occupancy === 'EMPTY';
  const isActor = view?.isActor ?? false;
  const isHero = view?.isHero ?? heroSeat === seat;
  const isButton = view?.isButton ?? tableButtonSeat === seat;
  const isSmallBlind = view?.isSmallBlind ?? false;
  const isBigBlind = view?.isBigBlind ?? false;
  const status = view?.status ?? null;
  const stack = view?.stack ?? tableSeat.stack;
  const folded = status === 'FOLDED';

  const editable = !empty && onCommitStack !== undefined && onBeginStackEdit !== undefined;
  const [stackText, setStackText] = useState('');
  const [rejection, setRejection] = useState<StackEditRejection | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Seeding and focus both key off the CALLER's `stackEditing`, so "Enter moves to the next
  // dirty seat" is one state change in the parent and not a chain of imperative focus calls.
  // The seed is the seat's own between-hands stack, formatted at full milliBB precision — the
  // user is correcting a number, and starting from a rounded one would lose their last entry.
  useEffect(() => {
    if (!stackEditing) return;
    setStackText(Money.formatBB(tableSeat.stack, { maxDecimals: 3 }));
    setRejection(null);
    const input = inputRef.current;
    if (input === null) return;
    input.focus();
    input.select();
    // `tableSeat.stack` is deliberately NOT a dependency: re-seeding the field because the
    // store's own commit changed the stack would overwrite what the user is typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stackEditing, seat]);

  const commit = (): void => {
    const parsed = parseStackText(stackText);
    if (!parsed.ok) {
      setRejection(parsed.rejection);
      return;
    }
    setRejection(null);
    onCommitStack?.(seat, parsed.value);
  };

  const markers: string[] = [];
  if (isButton) markers.push('BTN');
  if (isSmallBlind) markers.push('SB');
  if (isBigBlind) markers.push('BB');
  const position = view?.position ?? null;
  const showPosition = position !== null && !markers.includes(position);

  const statusText = empty
    ? ''
    : status === null
      ? SEAT_OCCUPANCY_LABEL[tableSeat.occupancy]
      : SEAT_STATUS_LABEL[status];

  const border = isActor
    ? 'border-actor-500 ring-2 ring-actor-500'
    : isHero
      ? 'border-hero-500'
      : dirty
        ? 'border-dirty-500'
        : selected
          ? 'border-ink-300'
          : 'border-surface-600';

  return (
    <div
      role="button"
      tabIndex={empty ? -1 : 0}
      aria-disabled={empty}
      data-testid={`seat-${seat}`}
      data-actor={isActor ? 'true' : 'false'}
      data-hero={isHero ? 'true' : 'false'}
      data-button={isButton ? 'true' : 'false'}
      data-sb={isSmallBlind ? 'true' : 'false'}
      data-bb={isBigBlind ? 'true' : 'false'}
      data-status={status ?? tableSeat.occupancy}
      data-dirty={dirty ? 'true' : 'false'}
      data-selected={selected ? 'true' : 'false'}
      onClick={empty ? undefined : () => onSelect(seat)}
      onKeyDown={(event) => {
        // ONLY the card itself activates. A keystroke aimed at the stack input inside it
        // belongs to that input (the same ownership rule `ActionDock`'s `isTypingTarget`
        // enforces for the hotkeys).
        if (empty || event.target !== event.currentTarget) return;
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onSelect(seat);
      }}
      className={`flex w-full min-w-0 flex-col gap-0.5 rounded-md border bg-surface-800 px-2 py-1 text-left ${border} ${
        folded ? 'opacity-50' : ''
      } ${empty ? 'cursor-default' : 'cursor-pointer hover:border-ink-500'}`}
    >
      <span className="flex items-center justify-between gap-1 text-[0.6rem] tracking-wide">
        <span className="truncate text-ink-500">{seatLabel(seat)}</span>
        <span className="flex items-center gap-0.5">
          {showPosition && (
            <span className="rounded bg-surface-600 px-1 text-ink-300">
              {POSITION_LABEL[position]}
            </span>
          )}
          {isButton && <span className="rounded bg-ink-100 px-1 text-surface-900">BTN</span>}
          {isSmallBlind && <span className="rounded bg-surface-500 px-1 text-ink-100">SB</span>}
          {isBigBlind && <span className="rounded bg-surface-500 px-1 text-ink-100">BB</span>}
          {isHero && <span className="rounded bg-hero-500 px-1 text-surface-900">나</span>}
        </span>
      </span>

      {/* Name and stack on ONE row: two facts that are always read together, and one row
          of vertical space instead of two. */}
      <span className="flex items-baseline justify-between gap-2">
        <span className="truncate text-sm font-medium">
          {empty ? <span className="text-ink-700">빈 좌석</span> : (nickname ?? '이름 없음')}
        </span>
        {!empty && !stackEditing && (
          editable ? (
            <button
              type="button"
              data-testid={`seat-${seat}-stack`}
              aria-label={`${seatLabel(seat)} ${STACK_EDIT_LABEL}`}
              onClick={(event) => {
                // The card selects on click; the stack does not. One gesture, one meaning.
                event.stopPropagation();
                onBeginStackEdit?.(seat);
              }}
              className={`shrink-0 rounded px-1 text-sm ${
                dirty ? 'bg-dirty-500 font-semibold text-surface-900' : 'text-ink-300 hover:bg-surface-600'
              }`}
            >
              {/* maxDecimals 3 = full milliBB: a stack is the user's ACTUAL value and is
                  never shown rounded (`CLAUDE.md` rule 3). */}
              <span className="tabular">
                {Money.formatBB(stack, { maxDecimals: 3, unit: true })}
              </span>
            </button>
          ) : (
            <span className="tabular shrink-0 text-sm text-ink-300">
              {Money.formatBB(stack, { maxDecimals: 3, unit: true })}
            </span>
          )
        )}
        {!empty && stackEditing && (
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            data-testid={`seat-${seat}-stack-input`}
            aria-label={`${seatLabel(seat)} ${STACK_EDIT_LABEL}`}
            value={stackText}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => setStackText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commit();
                return;
              }
              if (event.key === 'Escape') {
                event.preventDefault();
                onCancelStackEdit?.();
              }
            }}
            className="tabular w-20 shrink-0 rounded border border-actor-500 bg-surface-900 px-1 text-right text-sm text-ink-100"
          />
        )}
      </span>

      {/* WP-5: the seat says plainly that its number was never observed, and the input is
          right there rather than behind a panel. */}
      {dirty && (
        <span className="flex items-center justify-between gap-1 text-[0.6rem]">
          <span
            data-testid={`seat-${seat}-dirty`}
            className="rounded bg-dirty-500 px-1 font-semibold uppercase tracking-wide text-surface-900"
          >
            {SEAT_DIRTY_BADGE}
          </span>
        </span>
      )}

      {rejection !== null && stackEditing && (
        <span
          data-testid={`seat-${seat}-stack-error`}
          role="alert"
          className="text-[0.6rem] text-danger-500"
        >
          {STACK_EDIT_REJECTION_LABEL[rejection]}
        </span>
      )}

      <span className="flex items-center justify-between gap-1 text-[0.6rem] text-ink-500">
        <span className="flex min-w-0 items-center gap-1">
          <span data-testid={`seat-${seat}-status`}>{statusText}</span>
          {view?.lastAction !== null && view?.lastAction !== undefined && (
            <span className="truncate text-ink-500" data-testid={`seat-${seat}-last-action`}>
              {lastActionLabel(view.lastAction)}
            </span>
          )}
          {isActor && <span className="shrink-0 font-semibold text-actor-500">액션 차례</span>}
        </span>
        {view !== null && Money.isPositive(view.streetContribution) && (
          <span className="tabular shrink-0 text-ink-300" data-testid={`seat-${seat}-contribution`}>
            {Money.formatBB(view.streetContribution, { maxDecimals: 3, unit: true })}
          </span>
        )}
      </span>
    </div>
  );
}
