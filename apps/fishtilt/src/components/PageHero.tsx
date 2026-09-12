/**
 * `PageHero` — the top-of-page block every route uses: an optional eyebrow, the page's
 * single `<h1>`, an optional description, and an optional actions slot (buttons/links).
 * Keeping this in one component is what stops every page's hero from drifting into a
 * slightly different heading size or spacing as different WPs build different routes.
 *
 * ## Stage 3: one hero, three shapes (D-S3-13)
 *
 * The content audit found `PageHero` PARTIAL for an article head (no category label, no
 * deck, no meta row) and the layout brief asked for a split "editorial hero" for the home
 * page and the hubs. Both are the SAME object — an eyebrow, a title, a lead, a meta line,
 * an actions row, a picture — at a different scale and in a different arrangement, so
 * they are variants of this component rather than two more hero components:
 *
 *   variant `article` (default) — `text-article-h1`, 30px → 44px fluid. Long-form pages,
 *                                 tool pages, quizzes, hubs that keep a stacked head.
 *   variant `hero`              — `text-hero-h1`, 36px → 56px fluid. The home page and any
 *                                 hub that opens with a real editorial hero.
 *   layout  `stack` (default)   — everything in one column; `visual` renders under the text.
 *   layout  `split`             — text left (7/12), `visual` right (5/12) from `lg` up,
 *                                 collapsing to a stack on a phone. The text column is
 *                                 first in the DOM in both cases, so the `<h1>` is the first
 *                                 thing a screen reader meets.
 *
 * `ArticleHero` and `EditorialHero` (their own files) are thin, named entry points onto these
 * variants so a page can say what it is; both render this component and nothing else.
 *
 * `meta` is a slot rather than a string because `ArticleMeta` owns the meta row's shape
 * (level · read time · disclosure) and a hero should not grow a second copy of it. `facts`
 * is the hero's micro-fact row — "169 핸드 · 6 자리 · 무료" — plain label/value pairs with
 * no borders, which is `StatStrip`'s job at a smaller scale; it is rendered inline here so a
 * hero does not have to import a section primitive for three words.
 */
export type PageHeroVariant = 'article' | 'hero';
export type PageHeroLayout = 'stack' | 'split';

export interface PageHeroFact {
  readonly label: string;
  readonly value: string;
}

export interface PageHeroProps {
  readonly eyebrow?: string;
  readonly title: string;
  /** The deck / lead paragraph under the title. Prose measure (`max-w-lead`), Korean
   *  line breaking, one step above body size. */
  readonly description?: string;
  /** The actions slot: buttons/links rendered after the description and meta. */
  readonly children?: React.ReactNode;
  /** A meta row — `ArticleMeta`, or a plain `<p>` — rendered between the lead and the actions. */
  readonly meta?: React.ReactNode;
  /** A picture: `ContentThumbnail`, `EditorialImage`, `HomeHeroVisual`, a matrix. */
  readonly visual?: React.ReactNode;
  /** Micro-facts under the actions (hero variant): `[{ label: '핸드', value: '169' }]`. */
  readonly facts?: readonly PageHeroFact[];
  readonly variant?: PageHeroVariant;
  readonly layout?: PageHeroLayout;
  readonly className?: string;
}

const TITLE_CLASS: Readonly<Record<PageHeroVariant, string>> = {
  // `tracking-[-0.01em]`: a slight tightening reads as "display" at these sizes without
  // taking Hangul apart the way loose tracking does (see the eyebrow note below).
  article: 'text-article-h1 font-semibold tracking-[-0.01em] text-text-100',
  hero: 'text-hero-h1 font-bold tracking-[-0.015em] text-text-100',
};

const LEAD_CLASS: Readonly<Record<PageHeroVariant, string>> = {
  article: 'mt-4 max-w-lead prose-ko text-lg text-text-300',
  hero: 'mt-5 max-w-lead prose-ko text-lg text-text-300 sm:text-xl',
};

export function PageHero({
  eyebrow,
  title,
  description,
  children,
  meta,
  visual,
  facts,
  variant = 'article',
  layout = 'stack',
  className = '',
}: PageHeroProps) {
  const text = (
    <div className="min-w-0">
      {eyebrow ? (
        // Eyebrow tracking is deliberately small. The Latin wordmark carries 0.2em because
        // spacing letters is how you make a short Latin string read as a label rather than a
        // word — but a Hangul syllable block is already a self-contained square, so the same
        // treatment does not stylize it, it takes it apart: at 0.35em "핸드레인지" rendered as
        // "핸 드 레 인 지", five characters a reader has to reassemble. 0.06em is enough to
        // read as a label in a language that has no uppercase to signal one with.
        <p className="text-sm font-medium tracking-[0.06em] text-brand-500">{eyebrow}</p>
      ) : null}
      {/* Korean titles break between words, never inside a syllable run ("차이일\n까?" at 390px);
          `wrap-anywhere` is the escape hatch for a single word longer than the column. */}
      <h1 className={`${TITLE_CLASS[variant]} break-keep wrap-anywhere ${eyebrow ? 'mt-3' : ''}`}>
        {title}
      </h1>
      {/* The lead is prose and gets a prose measure of its own, so it does not run the full
          width of a grid page (`/tools`, `/practice`) at 1280px. */}
      {description ? <p className={LEAD_CLASS[variant]}>{description}</p> : null}
      {meta ? <div className="mt-4">{meta}</div> : null}
      {children ? (
        <div data-slot="actions" className="mt-6">
          {children}
        </div>
      ) : null}
      {facts !== undefined && facts.length > 0 ? (
        <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-3 sm:flex sm:flex-wrap sm:gap-x-8">
          {/* Two columns on a phone (390px wrapped "대상 · 레슨 · 비용" and orphaned "계정" on
              a fourth line); a single wrapping row from `sm` up (WP-S3-17). */}
          {facts.map((fact) => (
            <div key={fact.label} className="min-w-0">
              <dt className="text-xs font-medium tracking-[0.06em] text-text-300">{fact.label}</dt>
              <dd className="tabular mt-0.5 text-lg font-semibold text-text-100">{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );

  if (layout === 'split' && visual !== undefined) {
    return (
      <header
        data-variant={variant}
        data-layout={layout}
        className={`grid items-center gap-10 lg:grid-cols-12 lg:gap-12 ${className}`}
      >
        <div className="lg:col-span-7">{text}</div>
        <div className="min-w-0 lg:col-span-5">{visual}</div>
      </header>
    );
  }

  return (
    <header data-variant={variant} data-layout="stack" className={className}>
      {text}
      {visual !== undefined ? <div className="mt-8">{visual}</div> : null}
    </header>
  );
}
