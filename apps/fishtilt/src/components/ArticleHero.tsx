/**
 * `ArticleHero` — the head of a long-form page: category eyebrow, the `<h1>`, the deck, the
 * meta row (`ArticleMeta`) and an optional visual (`EditorialImage`, `ContentThumbnail`).
 *
 * A named entry point onto `PageHero`'s `article` variant, not a second hero (D-S3-13:
 * "one component with variants, not two"). It exists so that a page template reads
 * `<ArticleHero category="읽을거리" …>` rather than `<PageHero variant="article" …>`, and
 * so the contract name the content audit uses resolves to a real import.
 *
 * `category` is the eyebrow; `deck` is the lead. Both names are the editorial ones the
 * audit used, mapped here onto `PageHero`'s vocabulary once.
 */
import { PageHero, type PageHeroProps } from './PageHero.js';

export interface ArticleHeroProps {
  /** The category label above the title — "읽을거리", "레슨 3", "용어". */
  readonly category?: string;
  readonly title: string;
  /** The deck: one or two sentences that say what the piece is about. */
  readonly deck?: string;
  /** `ArticleMeta`, typically. */
  readonly meta?: React.ReactNode;
  readonly visual?: React.ReactNode;
  /** Actions (rare on an article; a "직접 확인하기" link on a Search Guide). */
  readonly children?: React.ReactNode;
  readonly layout?: PageHeroProps['layout'];
  readonly className?: string;
}

export function ArticleHero({
  category,
  title,
  deck,
  meta,
  visual,
  children,
  layout = 'stack',
  className = '',
}: ArticleHeroProps) {
  return (
    <PageHero
      variant="article"
      layout={layout}
      eyebrow={category}
      title={title}
      description={deck}
      meta={meta}
      visual={visual}
      className={className}
    >
      {children}
    </PageHero>
  );
}
