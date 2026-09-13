/**
 * `HomeBreathing` — the one pause in the home page (editorial upgrade §16).
 *
 * The page runs 정보 → 정보 → 도구 → 정보; this band breaks that rhythm once with a wide
 * picture, one sentence and one link into the curriculum. It is not a banner: no price, no
 * urgency, no second button, no claim — the sentence is the site's own premise, and the link
 * is the same Learn hub the header offers.
 *
 * The picture is `PAGE_VISUALS.homeBreathing` when the file exists, else `ThemeArt`; the
 * statement is live HTML over a left-weighted scrim, so it reflows on a phone and stays
 * readable in both themes (cover ink over `--ft-cover-*`).
 */
import { PAGE_VISUALS, pageVisual } from '../../content/visuals.js';
import { EditorialVisual } from '../visual/EditorialVisual.js';

export interface HomeBreathingProps {
  readonly href: string | null;
  readonly className?: string;
}

export const HOME_BREATHING_STATEMENT = ['숫자를 외우는 대신,', '왜 그런지 이해하세요.'] as const;
export const HOME_BREATHING_CTA = '홀덤 처음부터 배우기';

export function HomeBreathing({ href, className = '' }: HomeBreathingProps) {
  return (
    <div
      data-home="breathing"
      className={`relative isolate overflow-hidden rounded-xl ${className}`}
    >
      <EditorialVisual
        visual={pageVisual(PAGE_VISUALS.homeBreathing, 'basics')}
        aspect="21/9"
        rounded={false}
        motif={false}
        sizes="(min-width: 1280px) 1248px, 100vw"
        className="min-h-[24rem] sm:min-h-[26rem]"
      />
      <span aria-hidden="true" className="cover-scrim-side absolute inset-0" />
      <div className="cover-ink absolute inset-0 flex flex-col justify-end p-6 sm:justify-center sm:p-12 lg:p-16">
        <p className="max-w-lead text-3xl leading-[1.3] font-bold tracking-[-0.015em] break-keep sm:text-4xl lg:text-[2.75rem]">
          {HOME_BREATHING_STATEMENT[0]}
          <br />
          {HOME_BREATHING_STATEMENT[1]}
        </p>
        {href !== null ? (
          <p className="mt-7">
            <a
              href={href}
              className="inline-flex min-h-12 items-center gap-2 rounded-md bg-brand-600 px-5 font-semibold text-ink-on-brand outline-none transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              {HOME_BREATHING_CTA}
              <span aria-hidden="true">→</span>
            </a>
          </p>
        ) : null}
      </div>
    </div>
  );
}
