/**
 * `HandTimeline` — the actions of one street, in order, as a numbered list (D-S3-14).
 *
 * "UTG 레이즈 2.5BB → BTN 콜 → SB 폴드": who acted, what they did, for how much. It is the
 * story's replay, and it is an `<ol>` on `Timeline`'s rail so an article's step list and a
 * story's action list are one visual object.
 *
 * ## Strings, not money
 *
 * `amount` is a STRING — `"2.5BB"`, `"12BB"`, `"올인"` — and this component never adds,
 * compares or totals anything. CLAUDE.md rule 1 puts every money operation behind `Money`
 * in a domain package, and a presentation component that summed bets would be a second,
 * unaudited arithmetic path. The pot after the street, if the story states it, arrives as
 * `pot`, already computed and already formatted by whoever owns the hand-story schema
 * (WP-S3-06/08).
 *
 * `position` is a string too, so a story can say "상대" or "나"; when it happens to be one
 * of the six seat abbreviations the accessible name adds the Korean gloss the rest of the
 * site uses (`positionAccessibleName`), so a screen reader hears "버튼(BTN) 자리" and not
 * "비 티 엔".
 */
import type { StrategyPosition } from '@gto-self/strategy-core';
import { POSITION_GLOSS, positionAccessibleName } from '../features/range/index.js';
import { TIMELINE_RAIL } from './Timeline.js';

/** One action in a betting sequence. Shared with `BettingTimeline`. */
export interface BetAction {
  /** `"UTG"`, `"BTN"`, or a story's own name for the actor. */
  readonly position: string;
  /** `"레이즈"`, `"콜"`, `"폴드"`, `"체크"`, `"올인"`. Plain text. */
  readonly action: string;
  /** `"2.5BB"`, formatted by the caller. Plain text; never computed here. */
  readonly amount?: string;
  /** One short remark: "처음 참여", "3벳". */
  readonly note?: string;
  /** Mark the reader's own seat. */
  readonly hero?: boolean;
}

export interface HandTimelineProps {
  readonly actions: readonly BetAction[];
  /** The street, for the list's accessible name: "플랍 액션". */
  readonly street?: string;
  /** The pot after this street, already formatted: `"팟 7.5BB"`. */
  readonly pot?: string;
  readonly className?: string;
}

function isPosition(value: string): value is StrategyPosition {
  return Object.hasOwn(POSITION_GLOSS, value);
}

export function HandTimeline({ actions, street, pot, className = '' }: HandTimelineProps) {
  if (actions.length === 0) return null;
  const name = street === undefined ? '액션' : `${street} 액션`;

  return (
    <div className={className}>
      <ol aria-label={name} className={TIMELINE_RAIL.list}>
        {actions.map((action, index) => (
          <li
            // A hand can contain the same actor twice on one street (bet, then call a
            // raise), so the index is part of the key by design.
            key={`${index}-${action.position}`}
            data-hero={action.hero ? 'true' : undefined}
            className={`${TIMELINE_RAIL.item} pb-4`}
          >
            <span aria-hidden="true" className={TIMELINE_RAIL.marker}>
              {index + 1}
            </span>
            <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span
                aria-label={isPosition(action.position) ? positionAccessibleName(action.position) : undefined}
                className={`font-mono text-sm font-semibold ${action.hero ? 'text-brand-500' : 'text-text-100'}`}
              >
                {action.position}
              </span>
              <span className="prose-ko text-base text-text-100">{action.action}</span>
              {action.amount ? (
                <span className="tabular font-mono text-sm text-text-100">{action.amount}</span>
              ) : null}
              {action.note ? <span className="text-xs text-text-300">{action.note}</span> : null}
            </p>
          </li>
        ))}
      </ol>
      {pot ? <p className="tabular mt-3 pl-8 text-sm font-medium text-text-300">{pot}</p> : null}
    </div>
  );
}
