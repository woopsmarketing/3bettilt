'use client';

/**
 * The hand's action log, grouped by street.
 *
 * Two engine-owned sources, no third:
 *  - `view.actions` — every voluntary action (`ActionRecord`, already carrying its street,
 *    position and amounts).
 *  - the hand's own `events`, for the forced posts. Antes and blinds are ENGINE events and
 *    are deliberately not `ActionRecord`s (nobody chose them), but they are the first
 *    thing that happens in a hand and the log would be dishonest without them. They are
 *    read off the log verbatim; nothing is inferred or added up here.
 *
 * Every verb and street name comes from the exhaustive maps in `lib/table/copy.ts`, so a
 * new engine event is a compile error rather than an untranslated row.
 */
import { Money } from '@gto-self/shared';
import type { MilliBB } from '@gto-self/shared';
import type { ActionRecord, HandEvent, HandView, SeatIndex, Street } from '@gto-self/poker-core';
import { ACTION_LABEL, POSITION_LABEL, STREET_LABEL, seatLabel } from '../../lib/table/copy.js';

type PostEvent = HandEvent & {
  readonly kind: 'POST_ANTE' | 'POST_DEAD_BLIND' | 'POST_SB' | 'POST_BB';
  readonly seat: SeatIndex;
  readonly amount: MilliBB;
};

function isPost(event: HandEvent): event is PostEvent {
  return (
    event.kind === 'POST_ANTE' ||
    event.kind === 'POST_DEAD_BLIND' ||
    event.kind === 'POST_SB' ||
    event.kind === 'POST_BB'
  );
}

interface Row {
  readonly key: string;
  readonly seat: SeatIndex;
  readonly who: string;
  readonly label: string;
  readonly amount: string;
  readonly forced: boolean;
}

interface Group {
  readonly street: Street;
  readonly rows: readonly Row[];
}

function actionRow(record: ActionRecord): Row {
  const amount =
    record.toAmount !== null
      ? // `→ X` is the raise-TO marker: the amount is the seat's resulting street
        // contribution, not the extra it just put in.
        `→ ${Money.formatBB(record.toAmount, { maxDecimals: 3 })}`
      : Money.isPositive(record.amount)
        ? Money.formatBB(record.amount, { maxDecimals: 3 })
        : '';
  return {
    key: `a-${record.seq}`,
    seat: record.seat,
    who: record.position === null ? seatLabel(record.seat) : POSITION_LABEL[record.position],
    // `ALL_IN` already says all-in; only the other verbs need the suffix.
    label:
      ACTION_LABEL[record.kind] + (record.isAllIn && record.kind !== 'ALL_IN' ? ' (올인)' : ''),
    amount,
    forced: false,
  };
}

/** Presentation grouping only: walk the ordered log and start a group when street changes. */
function buildGroups(view: HandView, events: readonly HandEvent[]): readonly Group[] {
  const groups: { street: Street; rows: Row[] }[] = [];
  const openGroup = (street: Street): Row[] => {
    const last = groups[groups.length - 1];
    if (last !== undefined && last.street === street) return last.rows;
    const rows: Row[] = [];
    groups.push({ street, rows });
    return rows;
  };

  const posts = events.filter(isPost);
  if (posts.length > 0) {
    const rows = openGroup('PREFLOP');
    for (const post of posts) {
      const position = view.seats[post.seat].position;
      rows.push({
        key: `e-${post.seq}`,
        seat: post.seat,
        who: position === null ? seatLabel(post.seat) : POSITION_LABEL[position],
        label: ACTION_LABEL[post.kind],
        amount: Money.formatBB(post.amount, { maxDecimals: 3 }),
        forced: true,
      });
    }
  }

  for (const record of view.actions) {
    openGroup(record.street).push(actionRow(record));
  }
  return groups;
}

export interface ActionHistoryProps {
  readonly view: HandView | null;
  readonly events: readonly HandEvent[];
  readonly nicknameForSeat: (seat: SeatIndex) => string | null;
}

export function ActionHistory({ view, events, nicknameForSeat }: ActionHistoryProps) {
  const groups = view === null ? [] : buildGroups(view, events);

  return (
    <section
      data-testid="action-history"
      aria-label="액션 기록"
      className="flex min-h-0 flex-1 flex-col rounded-md border border-surface-700 bg-surface-800"
    >
      <h2 className="border-b border-surface-700 px-2 py-1 text-[0.6rem] uppercase tracking-widest text-ink-500">
        액션 기록
      </h2>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-1">
        {groups.length === 0 ? (
          <p className="text-[0.7rem] text-ink-700">아직 액션이 없습니다.</p>
        ) : (
          groups.map((group, index) => (
            <div key={`${group.street}-${index}`} className="mb-1.5">
              <p className="text-[0.6rem] uppercase tracking-widest text-ink-700">
                {STREET_LABEL[group.street]}
              </p>
              <ul>
                {group.rows.map((row) => (
                  <li
                    key={row.key}
                    data-testid="history-row"
                    className={`grid grid-cols-[4.5rem_minmax(0,1fr)_5rem] items-baseline gap-2 py-0.5 text-[0.7rem] ${
                      row.forced ? 'text-ink-500' : 'text-ink-300'
                    }`}
                  >
                    <span className="truncate text-ink-500">
                      {nicknameForSeat(row.seat) ?? row.who}
                    </span>
                    <span className="truncate">{row.label}</span>
                    <span className="tabular text-right">{row.amount}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
