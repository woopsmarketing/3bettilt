/**
 * `OutsFigure` — "N장 중 M장이 아웃츠", drawn as N squares.
 *
 * ## Why this picture and not a sentence
 *
 * "아웃츠 9장" is a phrase a beginner reads as a big number, because nine of anything sounds
 * like a lot. The thing the phrase is actually claiming is a RATIO against a pile they have
 * never seen counted — the cards still unseen after the flop — and the article's exact
 * percentage lands on someone who has not pictured that pile. Forty-seven squares with nine
 * of them filled is that ratio, at a glance, before any arithmetic.
 *
 * ## Every number here comes from `learn-core`
 *
 * The unseen count is `outsOdds`' own `unseenCards` (47 after the flop, 46 after the turn —
 * `UNSEEN_AFTER_FLOP` / `UNSEEN_AFTER_TURN`), NOT a number typed into this file. The out
 * count is the caller's, and it is validated by the same `outsOdds` the `<Fact name="OUTS_PROB">`
 * in the surrounding prose calls, so the picture and the percentage beside it cannot disagree
 * about how many cards there are. An illegal draw throws rather than drawing a plausible grid
 * (CLAUDE.md rule 5) — and because every content route is prerendered, that throw is a build
 * failure, not a runtime surprise.
 *
 * This component deliberately prints NO probability. The article's `<Fact>` already states
 * the exact figure in its own sentence, and a second rendering of the same quantity — with
 * its own rounding — is how two numbers for one fact start appearing on one page.
 *
 * ## Which nine
 *
 * The first `outs` squares in reading order. Unseen cards have no order, so there is no
 * "correct" nine to mark and any choice would be arbitrary; the caption says the picture is
 * showing a count, not a particular set of cards. Marking a scattered nine would look more
 * like data and be no more true.
 *
 * ## Cost and accessibility
 *
 * One `<rect>` per unseen card is 47 nodes, on one figure, on one page — the budget
 * `ContentThumbnail` works under exists because `/blog` renders twenty of those, and it does
 * not apply here. The grid is `aria-hidden`; the counts are stated as real text underneath,
 * so nothing is carried by the picture alone and nothing is carried by colour alone (WCAG
 * 1.4.1). Server component, no client JavaScript.
 */
import { DRAW_STREETS, outsOdds, type DrawStreet } from '@gto-self/learn-core';

export interface OutsFigureProps {
  /** Cards that complete the draw. Validated by `outsOdds`, not by this file. */
  readonly outs: number;
  /** `FLOP` (two cards to come) or `TURN` (one). */
  readonly street: DrawStreet;
  readonly className?: string;
}

/** The Korean name of each street, so the legend does not print `FLOP`. */
const STREET_LABEL: Readonly<Record<DrawStreet, string>> = {
  FLOP: '플랍',
  TURN: '턴',
};

/** Grid geometry. 12 columns fits 47 and 46 into four rows with one gap at the end. */
const COLUMNS = 12;
const CELL = 8;
const GAP = 2;
const STEP = CELL + GAP;

export function OutsFigure({ outs, street, className = '' }: OutsFigureProps) {
  if (!DRAW_STREETS.includes(street)) {
    throw new Error(
      `<OutsFigure street>: expected one of ${DRAW_STREETS.join('|')}, got "${street}"`,
    );
  }

  const resolution = outsOdds({ outs, street });
  if (!resolution.ok) {
    throw new Error(`<OutsFigure outs={${outs}} street="${street}">: ${resolution.error}`);
  }
  const { unseenCards } = resolution.value;

  const rows = Math.ceil(unseenCards / COLUMNS);
  const width = COLUMNS * STEP - GAP;
  const height = rows * STEP - GAP;

  return (
    // The diagram carries its own surface: `Figure` is markup and a caption only, so that a
    // component which already has a well (`RangeMatrixMini`) is not boxed twice.
    <div className={`rounded-lg border border-line-500 bg-ground-800 p-4 sm:p-5 ${className}`}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        focusable="false"
        role="presentation"
        aria-hidden="true"
        className="h-auto w-full max-w-figure text-line-500"
      >
        {/* Not an out: outline only, so the pile reads as "cards that exist" rather than as a
            second filled colour competing with the outs. */}
        <g fill="none" stroke="currentColor" strokeWidth="1">
          {Array.from({ length: unseenCards - outs }, (_, i) => {
            const index = outs + i;
            return (
              <rect
                key={index}
                x={(index % COLUMNS) * STEP + 0.5}
                y={Math.floor(index / COLUMNS) * STEP + 0.5}
                width={CELL - 1}
                height={CELL - 1}
                rx="1.5"
              />
            );
          })}
        </g>
        {/* The outs. `act-raise-500` is the site's "this cell is included" fill everywhere a
            range is drawn, which is the same idea one level down: these are the cards that
            are IN the set the sentence is talking about. */}
        <g fill="currentColor" className="text-act-raise-500">
          {Array.from({ length: outs }, (_, index) => (
            <rect
              key={index}
              x={(index % COLUMNS) * STEP}
              y={Math.floor(index / COLUMNS) * STEP}
              width={CELL}
              height={CELL}
              rx="1.5"
            />
          ))}
        </g>
      </svg>

      {/* Words, not colour. Both counts come from `outsOdds`; the multiplication is the
          reader's, not this component's. */}
      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-text-300">
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="inline-block h-3 w-3 rounded-sm bg-act-raise-500" />
          {`아웃츠 ${outs}장`}
        </li>
        <li className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-block h-3 w-3 rounded-sm border border-line-500"
          />
          {`아웃츠가 아닌 ${unseenCards - outs}장`}
        </li>
        <li>{`${STREET_LABEL[street]}에서 아직 보이지 않는 카드 ${unseenCards}장`}</li>
      </ul>
    </div>
  );
}
