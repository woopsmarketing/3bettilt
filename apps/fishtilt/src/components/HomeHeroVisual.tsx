/**
 * `HomeHeroVisual` — the picture at the top of the front page (contract AD / Z; VA-01).
 *
 * ## The hybrid, and which half of it exists today
 *
 * VA-01 (`3BETTILT_VISUAL_ASSET_MANIFEST.md`) is a hybrid: an AI-generated *scene* (a
 * player, a table, one warm key light, a red rim) with the one thing that must be exact —
 * five card faces — drawn by code on top of it. This session cannot generate images, so the
 * scene half is a deterministic CSS composition: a dark room that resolves into a charcoal
 * table rail, a pendant light from above, brand-red rim light from the left, a faint suit
 * motif in the dark — all token colours, so the light theme gets a pale, paper-felt version
 * of the same picture rather than a black square in a white page.
 *
 * The exact half is the five `PokerCard`s: `A♠ K♠ Q♠ J♠ 10♠`, fanned on the table. What
 * those five cards make is NOT typed here — `homeModel.heroHand()` asks the evaluator
 * (`bestFiveOf`) and the picture's accessible name is the evaluator's own reading.
 *
 * ## How the VA-01 photo drops in (no layout change)
 *
 * Pass `photo={{ src }}`. The photo replaces the CSS scene as the bottom layer, through
 * `EditorialImage` (next/image, `fill`, `priority`, decorative), inside the same 4:5 frame.
 * The card overlay is positioned in the manifest's reserved band — x 8–92 %, y 64–94 % —
 * which the photo's prompt leaves as empty felt, so nothing about the page moves: same
 * frame, same aspect, same overlay box, same accessible name. The scene layers are simply
 * not rendered when a photo is.
 *
 * ## Motion
 *
 * None. The composition is static, so there is nothing for `prefers-reduced-motion` to
 * reduce; the global reduced-motion rule in `globals.css` still covers hover transitions.
 */
import { rankOf, suitOf } from '@gto-self/shared';
import { EditorialImage } from './EditorialImage.js';
import { PokerCard } from './PokerCard.js';
import { SUIT_PATH } from './ContentThumbnail.js';
import { heroHand } from './home/homeModel.js';

export interface HomeHeroPhoto {
  /** A path under `public/` (or a configured remote) for the VA-01 scene. */
  readonly src: string;
}

export interface HomeHeroVisualProps {
  /** The VA-01 scene, when it exists. Absent today: the CSS scene renders instead. */
  readonly photo?: HomeHeroPhoto;
  readonly className?: string;
}

/** The overlay band VA-01 reserves for the cards: x 8–92 %, y 64–94 % of the frame. */
const OVERLAY_BOX = 'absolute inset-x-[8%] top-[64%] bottom-[6%]';

/** Fan geometry per card: rotation and lift, symmetric about the middle card. */
const FAN: readonly { readonly rotate: number; readonly lift: number }[] = [
  { rotate: -14, lift: 10 },
  { rotate: -7, lift: 3 },
  { rotate: 0, lift: 0 },
  { rotate: 7, lift: 3 },
  { rotate: 14, lift: 10 },
];

/** The CSS scene — every layer decorative, every colour a token. */
function Scene() {
  return (
    <div aria-hidden="true" className="absolute inset-0">
      {/* Room: darkest at the top, the table's own ground below. */}
      <div className="absolute inset-0 bg-linear-to-b from-ground-900 via-ground-800 to-ground-800" />
      {/* Pendant key light, from above centre. `panel-600` is the raised surface in both
          themes — lighter than the ground in dark AND in light — so it reads as light. */}
      <div className="absolute -top-[18%] left-1/2 h-[64%] w-[130%] -translate-x-1/2 rounded-[50%] bg-radial from-panel-600/80 via-panel-700/30 to-transparent" />
      {/* Brand-red rim light from off-frame left — the one saturated colour, one source. */}
      <div className="absolute -left-[35%] top-[6%] h-[86%] w-[70%] rounded-[50%] bg-radial from-brand-600/35 via-brand-950/25 to-transparent" />
      {/* Suit motif, in the dark of the room. Not a flat stamp (WP-S3-17): a CSS mask fades
          the mark from lit at the top — under the pendant — to nothing at the bottom, and a
          hairline outline sits a step outside the fill, the way an engraved mark catches
          light along one edge. One colour token at low alpha, no gradient `id` (the visual
          must carry no ids — see the test), so the light theme gets the same relief in
          dark-on-pale. */}
      <svg
        viewBox="0 0 100 100"
        focusable="false"
        aria-hidden="true"
        className="absolute -right-[6%] top-[4%] h-[54%] w-auto text-text-100 [mask-image:linear-gradient(to_bottom,black_10%,transparent_100%)]"
      >
        <path d={SUIT_PATH.s} fill="currentColor" fillOpacity="0.085" />
        <path
          d={SUIT_PATH.s}
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.16"
          strokeWidth="0.6"
          transform="translate(50 50) scale(1.06) translate(-50 -50)"
        />
      </svg>
      {/* The table: a charcoal felt ellipse whose top edge is the rail the cards sit
          behind. A one-pixel `line-500` ring is the rail's highlight, `scrim-900` under it
          is the drop into the felt. */}
      <div className="absolute inset-x-[-22%] top-[56%] h-[90%] rounded-[50%] bg-scrim-900" />
      <div className="absolute inset-x-[-20%] top-[57%] h-[90%] rounded-[50%] bg-radial-[at_50%_18%] from-panel-700 via-ground-800 to-ground-900 ring-1 ring-line-500/50" />
      {/* Felt texture: a fine dot lattice at 4 % — `text-100` so it is bright-on-dark and
          dark-on-light, i.e. a texture in both themes. */}
      <div className="absolute inset-x-[-20%] top-[57%] h-[90%] rounded-[50%] bg-[radial-gradient(var(--color-text-100)_0.6px,transparent_0.7px)] bg-[size:7px_7px] opacity-[0.045]" />
      {/* The key light's pool on the felt, where the cards are. */}
      <div className="absolute inset-x-[10%] top-[60%] h-[40%] rounded-[50%] bg-radial from-panel-600/45 to-transparent" />
    </div>
  );
}

export function HomeHeroVisual({ photo, className = '' }: HomeHeroVisualProps) {
  const hand = heroHand();
  const cardNames = hand.cards
    .map((card) => `${rankOf(card) === 'T' ? '10' : rankOf(card)}`)
    .join(' ');

  return (
    <div
      data-hero-visual={photo === undefined ? 'scene' : 'photo'}
      className={`relative aspect-[4/5] w-full overflow-hidden rounded-xl border border-line-500 bg-ground-800 shadow-raised ${className}`}
    >
      {photo === undefined ? (
        <Scene />
      ) : (
        <div className="absolute inset-0">
          <EditorialImage
            src={photo.src}
            alt=""
            decorative
            aspect="4/5"
            priority
            sizes="(min-width: 1024px) 480px, 100vw"
          />
        </div>
      )}

      {/* The exact half: five real card faces, one `role="img"` whose name is what the
          evaluator says they make. Each card is decorative inside it so the name is said
          once, not six times. */}
      <div
        role="img"
        aria-label={`${hand.reading}: 스페이드 ${cardNames}`}
        className={`${OVERLAY_BOX} flex items-end justify-center`}
      >
        <div className="flex origin-bottom items-end sm:scale-110 lg:scale-100 xl:scale-125">
          {hand.cards.map((card, index) => {
            const geometry = FAN[index] ?? { rotate: 0, lift: 0 };
            return (
              <span
                key={card}
                className={`inline-flex ${index === 0 ? '' : '-ml-3'}`}
                style={{
                  transform: `rotate(${geometry.rotate}deg) translateY(${geometry.lift}px)`,
                }}
              >
                <PokerCard
                  rank={rankOf(card)}
                  suit={suitOf(card)}
                  size="lg"
                  decorative
                  className="shadow-raised"
                />
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
