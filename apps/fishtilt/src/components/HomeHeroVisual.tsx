/**
 * `HomeHeroVisual` — the picture at the top of the front page (contract AD / Z; VA-01).
 *
 * ## The hybrid, and which half of it exists today
 *
 * VA-01 (`3BETTILT_VISUAL_ASSET_MANIFEST.md`) is a hybrid: an AI-generated *scene* (a
 * player, a table, one warm key light, a red rim) with the one thing that must be exact —
 * five card faces — drawn by code on top of it. The scene is `public/visuals/home-hero.jpg`
 * (`PAGE_VISUALS.homeHero`); when that file is missing the scene half falls back to
 * `ThemeArt` (the editorial system's drawn room) with its table object switched off. Either
 * way it keeps its dark palette in both themes; the frame is a `.cover-stage`, so the card
 * faces on it measure as they do on the dark site.
 *
 * The exact half is the five `PokerCard`s: `A♠ K♠ Q♠ J♠ 10♠`, fanned on the table. What
 * those five cards make is NOT typed here — `homeModel.heroHand()` asks the evaluator
 * (`bestFiveOf`) and the picture's accessible name is the evaluator's own reading.
 *
 * ## How the VA-01 photo drops in (no layout change)
 *
 * The page passes `photo={{ src }}` when `public/visuals/home-hero.jpg` exists
 * (`PAGE_VISUALS.homeHero`, resolved by `assetSource.ts`). The photo replaces the CSS scene as the bottom layer, through
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
import { ThemeArt } from './visual/ThemeArt.js';
import { PokerCard } from './PokerCard.js';
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

export function HomeHeroVisual({ photo, className = '' }: HomeHeroVisualProps) {
  const hand = heroHand();
  const cardNames = hand.cards
    .map((card) => `${rankOf(card) === 'T' ? '10' : rankOf(card)}`)
    .join(' ');

  return (
    <div
      data-hero-visual={photo === undefined ? 'scene' : 'photo'}
      className={`cover-stage relative aspect-[4/5] w-full overflow-hidden rounded-xl bg-ground-800 shadow-raised ${className}`}
    >
      {photo === undefined ? (
        // The drawn room (`ThemeArt`, story theme) without its table object — the five real
        // cards below are the object.
        <ThemeArt theme="story" variant="home-hero" motif={false} />
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
          {/* The hero tier of the cover overlay (`--ft-cover-hero`): the photo keeps its tone,
              only the felt under the five cards settles a little. */}
          <span aria-hidden="true" className="cover-scrim-hero absolute inset-0" />
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
