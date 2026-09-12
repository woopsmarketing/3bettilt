/**
 * `EditorialHero` — the split hero at the top of the home page and the hubs (D-S3-12):
 * eyebrow, a display-size `<h1>`, a lead, an actions row and a row of micro-facts on the
 * left; a large visual on the right. On a phone it stacks, text first.
 *
 * A named entry point onto `PageHero`'s `hero` variant with `layout="split"` — the same
 * component the article head uses, at display scale. The visual slot takes whatever the
 * page has that is worth being large: `HomeHeroVisual`, a `PositionDiagram`, an
 * `EditorialImage` with a fallback drawing. When no visual is given the hero stacks (there
 * is nothing to split against) and the text keeps the display scale.
 */
import { PageHero, type PageHeroFact } from './PageHero.js';

export interface EditorialHeroProps {
  readonly eyebrow?: string;
  readonly title: string;
  readonly lead?: string;
  /** The actions row: primary/secondary links. */
  readonly children?: React.ReactNode;
  readonly visual?: React.ReactNode;
  /** Micro-facts under the actions, rendered as a `<dl>` with no borders. */
  readonly facts?: readonly PageHeroFact[];
  readonly className?: string;
}

export function EditorialHero({
  eyebrow,
  title,
  lead,
  children,
  visual,
  facts,
  className = '',
}: EditorialHeroProps) {
  return (
    <PageHero
      variant="hero"
      layout={visual === undefined ? 'stack' : 'split'}
      eyebrow={eyebrow}
      title={title}
      description={lead}
      visual={visual}
      facts={facts}
      className={className}
    >
      {children}
    </PageHero>
  );
}
