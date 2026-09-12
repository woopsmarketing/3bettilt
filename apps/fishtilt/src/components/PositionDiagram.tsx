/**
 * `PositionDiagram` — the 6-max table with its six seats named (D-S3-15).
 *
 * `PositionLegend` explains the abbreviations in a line of text; this DRAWS where they
 * sit. A beginner's question about position is spatial — "버튼은 어디고, 왜 유리한가" — and
 * the answer is a picture of six seats around one table with the button marked and the
 * seat under discussion filled. Inline SVG, `currentColor`, the same tokens every other
 * drawing uses, so it is right in both themes without a colour of its own.
 *
 * ## What it draws and what it claims
 *
 * The seat ORDER (clockwise: BTN, SB, BB, UTG, HJ, CO) and the dealer button beside BTN are
 * rules of the game, not strategy, so drawing them is not a poker claim (CLAUDE.md rule 2).
 * The diagram states nothing about which seat is "good": `highlight` marks the seat the
 * lesson is talking about, and the lesson says why in prose.
 *
 * ## Text in the picture
 *
 * The seat labels are SVG `<text>` — live DOM, selectable, localisable — not paths. Prompt
 * §AA forbids baking text into a raster; it does not forbid text. The accessible name
 * (`role="img"`) says which seats are highlighted, in the Korean gloss the rest of the site
 * uses, so the picture carries the same information to a screen reader.
 */
import { STRATEGY_POSITIONS, type StrategyPosition } from '@gto-self/strategy-core';
import { POSITION_GLOSS } from '../features/range/index.js';
import { Figure } from './Figure.js';

export interface PositionDiagramProps {
  /** The seat(s) the lesson is talking about; drawn filled. */
  readonly highlight?: StrategyPosition | readonly StrategyPosition[];
  /** Draw the dealer button beside BTN. Default `true`. */
  readonly showButton?: boolean;
  /** A caption wraps the drawing in `Figure`. */
  readonly caption?: string;
  readonly className?: string;
}

const VIEW_W = 320;
const VIEW_H = 200;
const CX = 160;
const CY = 100;
const SEAT_R = 18;

/** Clockwise from the bottom, the way the button travels: BTN at the reader's own seat. */
const SEAT_ANGLE: Readonly<Record<StrategyPosition, number>> = {
  BTN: 90,
  SB: 150,
  BB: 210,
  UTG: 270,
  HJ: 330,
  CO: 30,
};

function seatCentre(position: StrategyPosition): { readonly x: number; readonly y: number } {
  const radians = (SEAT_ANGLE[position] * Math.PI) / 180;
  return {
    x: Math.round(CX + 132 * Math.cos(radians)),
    y: Math.round(CY + 76 * Math.sin(radians)),
  };
}

export function PositionDiagram({
  highlight,
  showButton = true,
  caption,
  className = '',
}: PositionDiagramProps) {
  const highlighted: ReadonlySet<StrategyPosition> = new Set(
    highlight === undefined ? [] : typeof highlight === 'string' ? [highlight] : highlight,
  );

  const name =
    highlighted.size === 0
      ? '6인 테이블의 여섯 자리(UTG, HJ, CO, BTN, SB, BB)를 그린 그림'
      : `6인 테이블 그림. ${[...highlighted]
          .map((position) => `${POSITION_GLOSS[position]}(${position})`)
          .join(', ')} 자리가 표시되어 있습니다.`;

  const button = seatCentre('BTN');

  const drawing = (
    <div data-highlight={[...highlighted].join(' ') || undefined} className={`w-full ${className}`}>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        role="img"
        aria-label={name}
        focusable="false"
        className="mx-auto h-auto w-full max-w-figure text-line-500"
      >
        {/* The table: the recessed well with the site's one border, like every diagram. */}
        <ellipse
          cx={CX}
          cy={CY}
          rx={100}
          ry={52}
          className="fill-ground-800"
          stroke="currentColor"
          strokeWidth={1.5}
        />
        {STRATEGY_POSITIONS.map((position) => {
          const { x, y } = seatCentre(position);
          const on = highlighted.has(position);
          return (
            <g key={position} data-seat={position} data-on={on ? 'true' : undefined}>
              <circle
                cx={x}
                cy={y}
                r={SEAT_R}
                className={on ? 'fill-brand-600' : 'fill-panel-600'}
                stroke={on ? 'none' : 'currentColor'}
                strokeWidth={1.5}
              />
              <text
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={11}
                fontWeight={700}
                fontFamily="var(--font-mono)"
                className={on ? 'fill-ink-on-brand' : 'fill-text-100'}
              >
                {position}
              </text>
            </g>
          );
        })}
        {showButton ? (
          <g data-dealer-button="true">
            <circle
              cx={button.x + 26}
              cy={button.y - 24}
              r={8}
              className="fill-text-100"
            />
            <text
              x={button.x + 26}
              y={button.y - 24}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={9}
              fontWeight={700}
              fontFamily="var(--font-mono)"
              className="fill-ground-900"
            >
              D
            </text>
          </g>
        ) : null}
      </svg>
    </div>
  );

  if (caption !== undefined) return <Figure caption={caption}>{drawing}</Figure>;
  return drawing;
}
