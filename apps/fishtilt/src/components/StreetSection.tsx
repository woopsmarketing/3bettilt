/**
 * `StreetSection` — one street of a hand story: heading, board, actions, narrative (D-S3-14).
 *
 * The hand-story template (prompt §AN) is the same five sections in the same order —
 * 프리플랍, 플랍, 턴, 리버, 쇼다운 — and each is this component: a heading with the street's
 * name, `BoardCards` for what is on the table so far, `HandTimeline` for what everyone did,
 * and the narrative as children. A story page therefore composes five of these and owns no
 * markup of its own, and every story reads the same way.
 *
 * Renders DATA PASSED IN. The typed story schema, its validation and the rule that the
 * board on the turn contains the flop are WP-S3-06/08's (D-S3-14); this component shows the
 * board it is given for the street it is given.
 */
import { BoardCards, type BoardCardsProps } from './BoardCards.js';
import { HandTimeline, type BetAction } from './HandTimeline.js';

export type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';

export const STREET_HEADING: Readonly<Record<Street, string>> = {
  preflop: '프리플랍',
  flop: '플랍',
  turn: '턴',
  river: '리버',
  showdown: '쇼다운',
};

export interface StreetSectionProps {
  readonly street: Street;
  /** Overrides the default street heading ("플랍 — 탑 페어가 떴다"). */
  readonly title?: string;
  /** The board as of this street. */
  readonly board?: Pick<BoardCardsProps, 'flop' | 'turn' | 'river'>;
  readonly actions?: readonly BetAction[];
  /** The pot after this street, already formatted. */
  readonly pot?: string;
  /** Heading level. `h2` in a story page; `h3` when the story is nested in a section. */
  readonly headingAs?: 'h2' | 'h3';
  /** The narrative — MDX prose or paragraphs. */
  readonly children?: React.ReactNode;
  readonly className?: string;
}

export function StreetSection({
  street,
  title,
  board,
  actions,
  pot,
  headingAs = 'h2',
  children,
  className = '',
}: StreetSectionProps) {
  const Heading = headingAs;
  const headingId = `street-${street}`;
  const label = STREET_HEADING[street];

  return (
    <section aria-labelledby={headingId} data-street={street} className={`my-12 ${className}`}>
      <Heading
        id={headingId}
        className={`scroll-mt-24 font-semibold text-text-100 ${headingAs === 'h2' ? 'text-h2' : 'text-lg'}`}
      >
        {title ?? label}
      </Heading>
      {board !== undefined ? (
        <BoardCards flop={board.flop} turn={board.turn} river={board.river} />
      ) : null}
      {actions !== undefined && actions.length > 0 ? (
        <HandTimeline actions={actions} street={label} pot={pot} className="my-6" />
      ) : null}
      {children ? <div className="mt-6">{children}</div> : null}
    </section>
  );
}
