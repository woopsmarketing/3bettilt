/**
 * `ContentThumbnail` — the picture on a content card, at the head of an article, and the
 * drawn fallback behind every `EditorialImage` that has no asset yet (WP-S3-03/05).
 *
 * ## What it draws, and why it is drawn rather than photographed
 *
 * FISHTILT_STATE ruling 112 settles the format question: 3BetTilt is Korean today and is
 * meant to become multilingual, so a thumbnail with its title burned into a PNG would have
 * to be regenerated 113 times per locale. Ruling 114 settles the data question: no content
 * record gains an image field before a real image exists. So a thumbnail is GENERATED, from
 * two fields the record already carries — `topic` decides the drawing and `kind` decides the
 * accent colour — and the title stays live DOM text beside it.
 *
 * Deterministic by construction: the drawing and the accent are two lookups in the two
 * frozen maps below. The same record produces the same picture on every render, on the
 * server, in a test and in a screenshot. There is no randomness, no stored per-record data
 * and no image file — `public/` gains nothing.
 *
 * ## The scene varies per item (WP-S3-19, review B-M1)
 *
 * Four of the six hand stories share `topic: 'hand-strength'`, and keyed on `(kind, topic)`
 * alone they shipped four pixel-identical pictures in one column — the clearest "generated
 * site" signal the product had. The DRAWING still belongs to the topic (a reader must
 * recognise the rank ladder as 족보 wherever it appears), but the SCENE under it — which
 * suit sits in the dark, where it sits, how large, and which side the warm light comes
 * from — is now chosen per item from the optional `variant` string (the record's own
 * stable `id`). The choice is a pure function of that string (`sceneVariant` below): the
 * same id draws the same scene forever, and no record gained a field. With no `variant`
 * the scene is the topic's default, so every existing render is unchanged.
 *
 * ## The scene under the drawing (WP-S3-05)
 *
 * Two blank cards with a red square on a flat grey box read as a placeholder, which is what
 * the blog hub looked like with twenty of them. Each thumbnail is now a small editorial
 * composition: a charcoal ground that grades from the raised surface to the page's own
 * black (tokens, so the light theme gets a paper version), one warm light from the upper
 * left (`brand-950`, the tint band's colour — never the identity red as a fill), a fine felt
 * lattice, and one large suit motif in the dark, chosen by topic. The line drawing sits on
 * top. Nothing in the scene is a poker fact: a suit is not a card, and no rank appears.
 *
 * ## Why these eight drawings
 *
 * WP-3's `HomeHeroVisual` set the precedent — the best picture this site has is its own
 * object — and this follows it at card scale. Each topic is drawn as the THING it is about,
 * simplified to line art: 규칙 is the board being dealt, 족보 is the rank ladder, 시작 패 is
 * the two cards you were handed, 핸드레인지 is the square chart with its pair diagonal, 자리
 * is the seats around the table, 베팅 is chips going in, 확률과 오즈 is a part of a whole,
 * 승률 is two hands over one pot. A reader who has used the site recognises the shape before
 * reading the chip.
 *
 * ## What it deliberately does NOT draw
 *
 * No rank, no filled range, no percentage. The 시작 패 cards carry a suit pip each, and a
 * pip alone names no hand — the two cards are "two cards", not `AKs`. The `range` drawing
 * marks its DIAGONAL, which is a structural property of the chart's axes and not a claim
 * about any range's membership. The `odds` bar divides into EQUAL quarters for the same
 * reason. Numbers that ARE poker facts appear in the body figures instead — `OutsFigure`
 * and `PotOddsFigure` compute theirs in `learn-core`.
 *
 * ## Cost
 *
 * `/blog` renders twenty of these, so every drawing is inline SVG under a hard node budget
 * (`ContentThumbnail.test.tsx`: 40 per topic and kind). The scene is three nodes. Server
 * component, zero client JavaScript, straight into the prerendered HTML.
 *
 * ## Colour and theme
 *
 * Every shape paints `currentColor` and every surface is a token class; there is no
 * hard-coded colour and nothing to re-check when the light theme redefines a token. No
 * SVG gradients: they need `id`s, and twenty identical ids on one page is exactly what the
 * "no element id appears twice" check forbids — the grading is CSS, on the frame.
 *
 * ## Accessibility
 *
 * `aria-hidden`, not `role="img"`. The title is always immediately beside the picture as
 * text and the topic is named in a chip right under it, so a name on the graphic would make
 * a screen reader announce the same thing three times.
 */
import type { ContentKind, ContentTopic } from '../content/types.js';

/**
 * `card` sits at the top of a `LinkCard`; `hero` is the same drawing at the head of an
 * article; `fill` is the same drawing inside a box whose shape the PARENT decides
 * (`EditorialImage`'s fallback). The drawing is identical — a reader must recognise the
 * picture they clicked — and only the frame differs: a card wants a 16:5 block above a
 * title, a page header wants a wider 24:5 band that does not push the prose down a screen.
 * The art is authored once in a 160x50 space and CENTRED in the wider box, so no shape
 * letterboxes.
 */
export type ThumbnailSize = 'card' | 'hero' | 'fill';

export interface ContentThumbnailProps {
  readonly kind: ContentKind;
  readonly topic: ContentTopic;
  readonly size?: ThumbnailSize;
  /**
   * A stable string that tells two items of the same topic apart — the record's `id`. It
   * picks the scene (suit motif, its placement and size, the light's side), never the
   * drawing. Omit it and the topic's default scene is drawn.
   */
  readonly variant?: string;
  readonly className?: string;
}

/**
 * The four suits as closed paths in a 100x100 box, so a suit can be drawn anywhere on the
 * site without a `<text>` glyph (ruling 112: nothing user-visible is text inside a
 * picture, and a glyph would also depend on the font). Shared with `HomeHeroVisual`.
 */
export const SUIT_PATH = {
  s: 'M50 4C50 4 12 38 12 58c0 14 11 22 22 22 6 0 11-3 14-7-2 11-8 19-14 23h32c-6-4-12-12-14-23 3 4 8 7 14 7 11 0 22-8 22-22C88 38 50 4 50 4z',
  h: 'M50 92C22 68 8 52 8 33 8 19 19 8 32 8c8 0 15 4 18 11 3-7 10-11 18-11 13 0 24 11 24 25 0 19-14 35-42 59z',
  d: 'M50 4l38 46-38 46-38-46z',
  c: 'M50 8a17 17 0 0 1 12 29 17 17 0 1 1-8 26c-1 12 4 24 12 33H34c8-9 13-21 12-33a17 17 0 1 1-8-26A17 17 0 0 1 50 8z',
} as const;

export type SuitKey = keyof typeof SUIT_PATH;

/**
 * The accent, chosen by kind. Each token already means this elsewhere in the app, so the
 * colour is a second copy of a signal the reader has met rather than a new code to learn:
 * `brand-500` is the reading accent `/blog`'s own eyebrow uses, `act-call-500` is the
 * "correct / confirmed" colour the quizzes use, `act-raise-500` is the in-range fill every
 * hand's chart cell carries, and `text-300` is the quiet ink a reference work is set in.
 */
const KIND_ACCENT: Readonly<Record<ContentKind, string>> = {
  learn: 'text-act-call-500',
  glossary: 'text-text-300',
  blog: 'text-brand-500',
  hands: 'text-act-raise-500',
};

/** The suit motif in the dark behind each topic's drawing. Decoration, chosen by topic. */
const TOPIC_MOTIF: Readonly<Record<ContentTopic, SuitKey>> = {
  rules: 's',
  'hand-strength': 'c',
  'starting-hands': 'h',
  range: 'd',
  position: 's',
  betting: 'c',
  odds: 'd',
  equity: 'h',
};

/** The space every drawing below is authored in. */
const ART_WIDTH = 160;
const ART_HEIGHT = 50;

interface Frame {
  /** Total viewBox width. The art is centred inside it. */
  readonly boxWidth: number;
  /** Frame classes — aspect ratio and corner radius, matching `boxWidth / ART_HEIGHT`. */
  readonly className: string;
  /** How the art SVG sits in the frame. */
  readonly artClassName: string;
}

const FRAME: Readonly<Record<ThumbnailSize, Frame>> = {
  card: { boxWidth: 160, className: 'aspect-[16/5] rounded-md', artClassName: 'h-full w-full' },
  hero: { boxWidth: 240, className: 'aspect-[24/5] rounded-lg', artClassName: 'h-full w-full' },
  /*
   * `fill` (WP-S3-03) sets NO aspect ratio of its own: it fills whatever box the parent
   * gives it, and the SVG's default `preserveAspectRatio` (`xMidYMid meet`) centres the
   * hero-width drawing inside that box. It is what `EditorialImage` renders when a page
   * asks for a picture at a real image aspect (16:9, 3:2) and no asset exists yet — the
   * same drawing the reader met on the card, in a larger frame, with no layout shift. The
   * drawing is inset (`p-[9%]`) so it reads as a figure on the scene rather than a band
   * stretched across it.
   */
  fill: { boxWidth: 240, className: 'h-full rounded-lg', artClassName: 'h-full w-full p-[9%]' },
};

/** Outlines. `fill="none"` plus one stroke width keeps every drawing at one line weight. */
const OUTLINE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinejoin: 'round',
} as const;

interface ArtProps {
  /** The `text-*` class the solid marks paint with. */
  readonly accent: string;
}

/**
 * 규칙 — the board being dealt: three cards together (the flop), then two apart (the turn
 * and the river), with the dealer button beside them. The sequence IS the rule a beginner
 * meets first.
 */
function RulesArt({ accent }: ArtProps) {
  return (
    <>
      <g {...OUTLINE}>
        <rect x="8" y="9" width="20" height="30" rx="3" />
        <rect x="32" y="9" width="20" height="30" rx="3" />
        <rect x="56" y="9" width="20" height="30" rx="3" />
        <rect x="86" y="9" width="20" height="30" rx="3" />
        <rect x="110" y="9" width="20" height="30" rx="3" />
      </g>
      <g fill="currentColor" className={accent}>
        <rect x="8" y="43" width="68" height="3" rx="1.5" />
        <circle cx="145" cy="24" r="7" />
      </g>
    </>
  );
}

/**
 * 족보 — the rank ladder. Wide at the bottom (the shapes you make often), narrow at the top
 * (the ones you almost never make), which is the whole reason the order is the order.
 */
function HandStrengthArt({ accent }: ArtProps) {
  return (
    <>
      <g {...OUTLINE}>
        <rect x="25" y="41" width="110" height="6" rx="3" />
        <rect x="35" y="32" width="90" height="6" rx="3" />
        <rect x="45" y="23" width="70" height="6" rx="3" />
        <rect x="55" y="14" width="50" height="6" rx="3" />
      </g>
      <g fill="currentColor" className={accent}>
        <rect x="65" y="5" width="30" height="6" rx="3" />
      </g>
    </>
  );
}

/**
 * 시작 패 — the two cards you were dealt, face up, side by side, each with one suit pip.
 * A pip is a suit, not a card: no rank, so these are "two cards" and never a hand class.
 */
function StartingHandsArt({ accent }: ArtProps) {
  return (
    <>
      <g {...OUTLINE}>
        <rect x="42" y="4" width="34" height="42" rx="4" />
        <rect x="84" y="4" width="34" height="42" rx="4" />
      </g>
      <g fill="currentColor" className={accent}>
        <svg x="52" y="16" width="14" height="14" viewBox="0 0 100 100">
          <path d={SUIT_PATH.s} />
        </svg>
        <svg x="94" y="16" width="14" height="14" viewBox="0 0 100 100">
          <path d={SUIT_PATH.h} />
        </svg>
      </g>
    </>
  );
}

const RANGE_ORIGIN_X = 59;
const RANGE_ORIGIN_Y = 4;
const RANGE_CELL = 6;
const RANGE_COLUMNS = 7;

/**
 * 핸드레인지 — the square chart, with its diagonal marked.
 *
 * Seven columns rather than thirteen, and the lines are ONE path rather than sixteen
 * elements: a literal 13x13 would be 169 nodes on each of twenty cards. The diagonal is the
 * one thing about that grid that holds regardless of which range is loaded, which is why it
 * is the part that gets marked (see the module doc).
 */
function RangeArt({ accent }: ArtProps) {
  const span = RANGE_CELL * RANGE_COLUMNS;
  const lines: string[] = [];
  for (let i = 0; i <= RANGE_COLUMNS; i += 1) {
    lines.push(`M${RANGE_ORIGIN_X + i * RANGE_CELL} ${RANGE_ORIGIN_Y}v${span}`);
    lines.push(`M${RANGE_ORIGIN_X} ${RANGE_ORIGIN_Y + i * RANGE_CELL}h${span}`);
  }
  return (
    <>
      <g {...OUTLINE}>
        <path d={lines.join('')} />
      </g>
      <g fill="currentColor" className={accent}>
        {Array.from({ length: RANGE_COLUMNS }, (_, i) => (
          <rect
            key={i}
            x={RANGE_ORIGIN_X + i * RANGE_CELL}
            y={RANGE_ORIGIN_Y + i * RANGE_CELL}
            width={RANGE_CELL}
            height={RANGE_CELL}
            rx="1"
          />
        ))}
      </g>
    </>
  );
}

/** 자리 — six seats around one table, with the seat you are sitting in filled. */
function PositionArt({ accent }: ArtProps) {
  return (
    <>
      <g {...OUTLINE}>
        <ellipse cx="80" cy="25" rx="50" ry="16" />
        <circle cx="24" cy="25" r="6" />
        <circle cx="50" cy="6" r="6" />
        <circle cx="110" cy="6" r="6" />
        <circle cx="136" cy="25" r="6" />
        <circle cx="110" cy="44" r="6" />
      </g>
      <g fill="currentColor" className={accent}>
        <circle cx="50" cy="44" r="6" />
      </g>
    </>
  );
}

/** 베팅 — chips going in: three stacks seen from the table's edge, each taller than the last. */
function BettingArt({ accent }: ArtProps) {
  return (
    <>
      <g {...OUTLINE}>
        <ellipse cx="39" cy="38" rx="15" ry="4" />
        <path d="M24 38v-6a15 4 0 0 1 30 0v6" />
        <ellipse cx="80" cy="38" rx="15" ry="4" />
        <path d="M65 38V22a15 4 0 0 1 30 0v16" />
        <path d="M65 30a15 4 0 0 0 30 0" />
      </g>
      <g fill="currentColor" className={accent}>
        <ellipse cx="121" cy="38" rx="15" ry="4" />
        <path d="M106 38V12a15 4 0 0 1 30 0v26z" />
      </g>
    </>
  );
}

/** 확률과 오즈 — a part of a whole, divided into equal quarters (see the module doc). */
function OddsArt({ accent }: ArtProps) {
  return (
    <>
      <g {...OUTLINE}>
        <rect x="16" y="17" width="128" height="16" rx="4" />
        <path d="M48 17v16M80 17v16M112 17v16" />
      </g>
      <g fill="currentColor" className={accent}>
        <rect x="18" y="19" width="28" height="12" rx="2" />
      </g>
    </>
  );
}

/**
 * 승률 — two hands over the same pot, and the part they are both playing for.
 *
 * Two overlapping circles with the lens between them filled. Two circles of r=20 whose
 * centres are 32 apart intersect at exactly (80, 25 ± 12), so the lens is drawn as two arcs
 * of the real circles rather than as an approximated ellipse.
 */
function EquityArt({ accent }: ArtProps) {
  return (
    <>
      <g {...OUTLINE}>
        <circle cx="64" cy="25" r="20" />
        <circle cx="96" cy="25" r="20" />
      </g>
      <g fill="currentColor" className={accent}>
        <path d="M80 13A20 20 0 0 1 80 37A20 20 0 0 1 80 13Z" />
      </g>
    </>
  );
}

/**
 * The eight drawings, one per topic. A `Record` over the union rather than a `switch`, so
 * adding a topic to `src/content/types.ts` without drawing it is a type error rather than a
 * blank card.
 */
const TOPIC_ART: Readonly<Record<ContentTopic, (props: ArtProps) => React.JSX.Element>> = {
  rules: RulesArt,
  'hand-strength': HandStrengthArt,
  'starting-hands': StartingHandsArt,
  range: RangeArt,
  position: PositionArt,
  betting: BettingArt,
  odds: OddsArt,
  equity: EquityArt,
};

/** Where the suit motif sits in the frame. `corner` is the original composition. */
type MotifPlacement = 'corner' | 'left' | 'high';
/** How large the motif is drawn, as a share of the frame's height. */
type MotifScale = 'large' | 'medium';
/** Which side the warm light enters from. */
type LightSide = 'left' | 'right';

export interface SceneVariant {
  readonly motif: SuitKey;
  readonly placement: MotifPlacement;
  readonly scale: MotifScale;
  readonly light: LightSide;
}

const SUIT_KEYS: readonly SuitKey[] = ['s', 'h', 'd', 'c'];
const PLACEMENTS: readonly MotifPlacement[] = ['corner', 'left', 'high'];
const SCALES: readonly MotifScale[] = ['large', 'medium'];
const LIGHTS: readonly LightSide[] = ['left', 'right'];

/**
 * FNV-1a over the UTF-16 code units, folded to an unsigned 32-bit integer and then rotated
 * by a byte. Not a security hash and not a cache key: a small, stable function of a short
 * id whose LOW digits (the ones the choices below read) vary between ids that share a long
 * common prefix — `blog-aa-loses` / `blog-ak-flop-miss` — so siblings spread over the suits
 * instead of landing next to each other. The rotation is what makes the four
 * `hand-strength` stories take four different suits; `ContentThumbnail.test.tsx` pins that.
 */
function fold(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return ((hash >>> 8) | (hash << 24)) >>> 0;
}

/**
 * The scene for an item. With no `variant` it is the topic's own: its suit, in the corner,
 * large, lit from the left — exactly the composition every card drew before WP-S3-19. With
 * one, the four choices are read off successive digits of the fold, so a topic's items
 * spread across the 48 compositions instead of sharing one.
 */
export function sceneVariant(topic: ContentTopic, variant?: string): SceneVariant {
  if (variant === undefined || variant === '') {
    return { motif: TOPIC_MOTIF[topic], placement: 'corner', scale: 'large', light: 'left' };
  }
  const h = fold(`${topic}:${variant}`);
  return {
    motif: SUIT_KEYS[h % SUIT_KEYS.length] ?? 's',
    placement: PLACEMENTS[Math.floor(h / 4) % PLACEMENTS.length] ?? 'corner',
    scale: SCALES[Math.floor(h / 12) % SCALES.length] ?? 'large',
    light: LIGHTS[Math.floor(h / 24) % LIGHTS.length] ?? 'left',
  };
}

const LIGHT_CLASS: Readonly<Record<LightSide, string>> = {
  left: 'absolute -left-[12%] -top-[60%] z-0 h-[150%] w-[60%] rounded-[50%] bg-radial from-brand-950/70 via-brand-950/20 to-transparent',
  right:
    'absolute -right-[12%] -top-[60%] z-0 h-[150%] w-[60%] rounded-[50%] bg-radial from-brand-950/70 via-brand-950/20 to-transparent',
};

const PLACEMENT_CLASS: Readonly<Record<MotifPlacement, string>> = {
  corner: 'absolute -bottom-[28%] right-[3%] z-0 w-auto text-text-100/[0.06]',
  left: 'absolute -bottom-[28%] left-[2%] z-0 w-auto text-text-100/[0.06]',
  high: 'absolute -top-[22%] right-[8%] z-0 w-auto text-text-100/[0.06]',
};

const SCALE_CLASS: Readonly<Record<MotifScale, string>> = {
  large: 'h-[120%]',
  medium: 'h-[84%]',
};

/**
 * The scene: the warm light, the felt lattice, the suit motif. Three nodes, all painted
 * with tokens, all behind the drawing (`z-0` under the art's `z-10`). Rendered AFTER the
 * art so the frame's first `<svg>` is still the drawing — which is what the tests, and
 * `EditorialImage`, look at.
 */
function Scene({ scene }: { readonly scene: SceneVariant }) {
  return (
    <>
      <span className={LIGHT_CLASS[scene.light]} />
      <span className="absolute inset-0 z-0 bg-[radial-gradient(var(--color-text-100)_0.6px,transparent_0.7px)] bg-[size:6px_6px] opacity-[0.05]" />
      <svg
        viewBox="0 0 100 100"
        focusable="false"
        role="presentation"
        data-motif={scene.motif}
        data-placement={scene.placement}
        className={`${PLACEMENT_CLASS[scene.placement]} ${SCALE_CLASS[scene.scale]}`}
      >
        <path d={SUIT_PATH[scene.motif]} fill="currentColor" />
      </svg>
    </>
  );
}

export function ContentThumbnail({
  kind,
  topic,
  size = 'card',
  variant,
  className = '',
}: ContentThumbnailProps) {
  const Art = TOPIC_ART[topic];
  const accent = KIND_ACCENT[kind];
  const frame = FRAME[size];
  const scene = sceneVariant(topic, variant);
  const offsetX = (frame.boxWidth - ART_WIDTH) / 2;

  return (
    // A charcoal ground that grades from the raised surface to the page's own black: the
    // picture sits INTO the card rather than on top of it. A `<span>`, not a `<div>` —
    // `LinkCard`'s visual slot lives inside an `<a>`, where flow content would be invalid.
    <span
      aria-hidden="true"
      data-topic={topic}
      data-kind={kind}
      data-variant={variant === undefined || variant === '' ? undefined : variant}
      className={`relative block w-full overflow-hidden border border-line-500 bg-linear-to-br from-panel-700 via-ground-800 to-ground-900 ${frame.className} ${className}`}
    >
      <svg
        viewBox={`0 0 ${frame.boxWidth} ${ART_HEIGHT}`}
        focusable="false"
        role="presentation"
        // The neutral line weight for the whole drawing. Each art's solid marks re-point
        // `currentColor` on their own group, so only they take the accent.
        className={`relative z-10 text-line-500 ${frame.artClassName}`}
      >
        {offsetX === 0 ? (
          <Art accent={accent} />
        ) : (
          <g transform={`translate(${offsetX} 0)`}>
            <Art accent={accent} />
          </g>
        )}
      </svg>
      <Scene scene={scene} />
    </span>
  );
}
