/**
 * `Figure` — a picture in the middle of an article, with a caption.
 *
 * ## The gap this fills
 *
 * 3BetTilt's articles already put real objects inside the prose: `PokerCards` renders actual
 * cards resolved from the hand-class model, `RangeMatrixMini` embeds the live 13x13 chart.
 * What none of them had was a CAPTION or figure semantics. A picture landed between two
 * paragraphs as an unlabelled block, and the sentence explaining it was an ordinary paragraph
 * that a reader had to guess belonged to the picture rather than to the argument.
 *
 * `<figure>`/`<figcaption>` is the element pair HTML has for exactly that association, and it
 * is what lets a screen reader announce "그림: ..." rather than reading a stray sentence, and
 * what lets a reader who skims the pictures still know what each one shows.
 *
 * ## Why the caption is a prop and not a paragraph
 *
 * `src/content/threshold.ts`'s `measureContent` strips JSX ATTRIBUTES and keeps JSX CHILDREN,
 * because children are prose the reader sees. A caption written as a prop is therefore not
 * counted as body prose — which is correct: a caption is a label on a picture, not an
 * article's argument, and an article must not clear the 900-character indexability floor on
 * the strength of its captions. It also means adding a figure to a shipped article cannot
 * move its measured `readMinutes`, so no registry record has to change.
 *
 * ## What may go inside, and why there is no frame around it
 *
 * Anything the MDX allow-list already permits, plus this work package's two data-driven
 * diagrams (`OutsFigure`, `PotOddsFigure`). What must NOT go inside is a raster with words
 * baked into it — FISHTILT_STATE ruling 112 — and there is none to put there: `public/` holds
 * one file and this component adds nothing to it.
 *
 * This component draws NO surface of its own. It is markup and a caption, nothing else.
 * `RangeMatrixMini` already carries the site's `ground-800` well, and a frame here would put
 * that box inside a second identical box; so the surface belongs to whatever is being
 * captioned, and every diagram brings its own.
 */
export interface FigureProps {
  /**
   * What the picture shows, in the article's own voice. Required: an uncaptioned figure is
   * the state this component exists to end, and an optional caption would be omitted by the
   * next author in a hurry.
   */
  readonly caption: string;
  readonly children: React.ReactNode;
  readonly className?: string;
}

export function Figure({ caption, children, className = '' }: FigureProps) {
  return (
    // `my-8` is `Callout`'s rhythm, so an aside and a figure sit at the same distance from
    // the prose and an article does not develop two vertical rhythms.
    <figure className={`my-8 ${className}`}>
      {children}
      {/* `text-300`, not `text-500`: WP-2's token table reserves `text-500` for UI-only ink
          and forbids it on prose in either theme, and a caption is prose. No hand-written
          `leading-[…]` either — `text-sm` already carries WP-2's 1.75 line-height token. */}
      <figcaption className="mt-3 text-sm text-text-300">{caption}</figcaption>
    </figure>
  );
}
