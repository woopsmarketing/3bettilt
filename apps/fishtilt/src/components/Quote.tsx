/**
 * `Quote` — a pull quote: one sentence set large, with who said it (D-S3-13).
 *
 * Not the Markdown `>` blockquote, which `mdx-components.tsx` sets quietly in `text-300`
 * for a quoted passage inside the argument. This is the editorial moment — a line from a
 * hand story's narrator, a maxim the lesson turns on — and it is set in the page ink at
 * `text-xl`, with the brand rule beside it. `<figure>`/`<blockquote>`/`<figcaption>` so the
 * attribution is attached to the quote rather than floating as a paragraph.
 *
 * Prose only: a quote that states a number is a claim, and claims go through `<Fact>`.
 */
export interface QuoteProps {
  readonly children: React.ReactNode;
  /** Who said it, or where it is from. Plain text. */
  readonly cite?: string;
  readonly className?: string;
}

export function Quote({ children, cite, className = '' }: QuoteProps) {
  return (
    <figure className={`my-10 border-l-4 border-brand-500 pl-6 ${className}`}>
      <blockquote className="prose-ko text-xl font-medium text-text-100 sm:text-2xl">
        {children}
      </blockquote>
      {cite !== undefined ? (
        <figcaption className="mt-3 text-sm text-text-300">— {cite}</figcaption>
      ) : null}
    </figure>
  );
}
