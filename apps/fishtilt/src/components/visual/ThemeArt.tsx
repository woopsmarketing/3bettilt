/**
 * `ThemeArt` — the drawn stand-in for a featured picture that does not exist yet.
 *
 * Every visual slot (`EditorialVisual`) renders this when `public/visuals/` has no file for
 * the page. It is composed like the photograph it stands in for — a charcoal room, one deep
 * red practical light, the rim of a table, a soft vignette — with one quiet object per theme
 * on the table. It is NOT a placeholder box, and it is NOT information:
 *
 * - no rank, no suit, no board, no number, no filled range. Cards are drawn FACE DOWN; the
 *   `range` grid is uniform (its diagonal is a property of the chart's axes, not a range);
 *   the `math` ring divides into equal quarters. Real cards are `PokerCards`, drawn from data.
 * - the palette is fixed (`.theme-art*` in `globals.css`), because a photograph does not
 *   change with the theme either; the overlay above it does (`--ft-cover-*`).
 *
 * Deterministic: the theme picks the object, `variant` (the record id) picks where the light
 * enters and nudges the object, so sibling pages of one theme are related, not identical.
 * Server component, inline SVG, no `id`s (twenty of these share a hub page), `aria-hidden`.
 */
import type { VisualThemeId } from '../../content/visuals.js';

export interface ThemeArtProps {
  readonly theme: VisualThemeId;
  readonly variant?: string;
  /** Draw the theme's object on the table. Off when real content is laid over the art. */
  readonly motif?: boolean;
  readonly className?: string;
}

type LightPosition = 'left' | 'center' | 'right';
const LIGHTS: readonly LightPosition[] = ['left', 'center', 'right'];

/** FNV-1a, 32-bit. A stable pick from a short id — not a security or cache hash. */
export function artSeed(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

export function artLight(theme: VisualThemeId, variant?: string): LightPosition {
  if (variant === undefined || variant === '') return 'left';
  return LIGHTS[artSeed(`${theme}:${variant}`) % LIGHTS.length] ?? 'left';
}

const CARD_W = 17;
const CARD_H = 24;

/** A face-down card: body, inset frame, a small centre mark. Never a rank or a suit. */
function CardBack({
  x,
  y,
  rotate = 0,
}: {
  readonly x: number;
  readonly y: number;
  readonly rotate?: number;
}) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate} ${CARD_W / 2} ${CARD_H / 2})`}>
      <rect width={CARD_W} height={CARD_H} rx="1.8" className="theme-art__card" />
      <rect
        x="2.2"
        y="2.2"
        width={CARD_W - 4.4}
        height={CARD_H - 4.4}
        rx="0.9"
        className="theme-art__card-inset"
      />
      <path
        d={`M${CARD_W / 2} ${CARD_H / 2 - 3} l2.4 3 l-2.4 3 l-2.4 -3 z`}
        className="theme-art__accent"
      />
    </g>
  );
}

function Chip({
  cx,
  cy,
  r = 4.2,
}: {
  readonly cx: number;
  readonly cy: number;
  readonly r?: number;
}) {
  return (
    <g>
      <ellipse cx={cx} cy={cy + 1.4} rx={r} ry={r * 0.42} className="theme-art__chip-side" />
      <ellipse cx={cx} cy={cy} rx={r} ry={r * 0.42} className="theme-art__chip" />
      <ellipse cx={cx} cy={cy} rx={r * 0.62} ry={r * 0.26} className="theme-art__line" />
    </g>
  );
}

function ChipStack({
  cx,
  base,
  count,
}: {
  readonly cx: number;
  readonly base: number;
  readonly count: number;
}) {
  return (
    <g>
      {Array.from({ length: count }, (_, i) => (
        <Chip key={i} cx={cx} cy={base - i * 1.9} />
      ))}
    </g>
  );
}

function Motif({ theme, nudge }: { readonly theme: VisualThemeId; readonly nudge: number }) {
  switch (theme) {
    case 'basics':
      return (
        <g transform={`translate(${nudge} 0)`}>
          {[0, 1, 2, 3, 4].map((i) => (
            <CardBack key={i} x={36 + i * 18.5} y={56} />
          ))}
        </g>
      );
    case 'rankings':
      return (
        <g transform={`translate(${nudge} 0)`}>
          {[-24, -12, 0, 12, 24].map((angle, i) => (
            <g key={angle} transform={`rotate(${angle} 80 96)`}>
              <CardBack x={71.5} y={52 + Math.abs(i - 2) * 0.8} />
            </g>
          ))}
        </g>
      );
    case 'starting-hands':
      return (
        <g transform={`translate(${nudge} 0)`}>
          <CardBack x={66} y={55} rotate={-9} />
          <CardBack x={77} y={54} rotate={7} />
        </g>
      );
    case 'range':
      return (
        <g transform={`translate(${nudge} 0) translate(58 30)`}>
          {Array.from({ length: 13 }, (_, row) =>
            Array.from({ length: 13 }, (_, col) => (
              <rect
                key={`${row}-${col}`}
                x={col * 3.4}
                y={row * 3.4}
                width="2.8"
                height="2.8"
                rx="0.4"
                className={row === col ? 'theme-art__cell-diagonal' : 'theme-art__cell'}
              />
            )),
          )}
        </g>
      );
    case 'position':
      return (
        <g transform={`translate(${nudge} 0)`}>
          <ellipse cx="80" cy="66" rx="42" ry="15" className="theme-art__line" />
          {[
            [80, 49.5],
            [118, 57],
            [118, 75],
            [80, 82.5],
            [42, 75],
            [42, 57],
          ].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="3" className="theme-art__seat" />
          ))}
          <circle cx="103" cy="72" r="2.2" className="theme-art__button" />
        </g>
      );
    case 'betting':
      return (
        <g transform={`translate(${nudge} 0)`}>
          <ChipStack cx={62} base={76} count={6} />
          <ChipStack cx={74} base={79} count={4} />
          <ChipStack cx={96} base={75} count={8} />
          <Chip cx={84} cy={84} />
        </g>
      );
    case 'math':
      return (
        <g transform={`translate(${nudge} 0)`}>
          <circle cx="80" cy="50" r="22" className="theme-art__line" />
          <circle cx="80" cy="50" r="15" className="theme-art__line-faint" />
          <path d="M80 28 A22 22 0 0 1 102 50" className="theme-art__arc" />
          <path d="M80 28 V72 M58 50 H102" className="theme-art__line-faint" />
        </g>
      );
    case 'story':
      return (
        <g transform={`translate(${nudge} 0)`}>
          <CardBack x={50} y={58} rotate={-12} />
          <CardBack x={60} y={57} rotate={4} />
          <ChipStack cx={104} base={80} count={5} />
          <Chip cx={92} cy={83} />
        </g>
      );
  }
}

export function ThemeArt({ theme, variant, motif = true, className = '' }: ThemeArtProps) {
  const light = artLight(theme, variant);
  const nudge = variant === undefined || variant === '' ? 0 : (artSeed(variant) % 17) - 8;
  return (
    <span
      aria-hidden="true"
      data-theme-art={theme}
      data-light={light}
      className={`theme-art ${className}`}
    >
      <span className="theme-art__lamp" />
      <span className="theme-art__table" />
      {motif ? (
        <svg
          viewBox="0 0 160 90"
          preserveAspectRatio="xMidYMax meet"
          focusable="false"
          role="presentation"
          className="theme-art__motif"
        >
          <Motif theme={theme} nudge={nudge} />
        </svg>
      ) : null}
      <span className="theme-art__grain" />
      <span className="theme-art__vignette" />
    </span>
  );
}
