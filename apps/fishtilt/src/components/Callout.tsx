/**
 * `Callout` — the aside an article reaches for when it wants to answer the question the
 * reader just formed ("왜 무늬를 묶어서 보나요?") without breaking the main thread.
 *
 * A thin wrapper over WP-A's `ExplanationCard` rather than a second card style: the whole
 * point of that component is that "this is an explanation of the content" reads differently
 * from "this is the content" everywhere in the app. What this adds is the MDX-facing shape —
 * a `title` string and markdown children — plus the vertical rhythm the surrounding prose
 * expects.
 */
import { ExplanationCard, type ExplanationCardVariant } from './ExplanationCard.js';

export interface CalloutProps {
  readonly title?: string;
  readonly children: React.ReactNode;
  /** `explain` (default) or `key` — see `ExplanationCard`. `KeyPoint` is the named entry
   *  point onto `key`, so an article can write `<KeyPoint>` (D-S3-13). */
  readonly variant?: ExplanationCardVariant;
  readonly className?: string;
}

const BODY: Readonly<Record<ExplanationCardVariant, string>> = {
  // One step under the prose size, same leading, so a callout does not read as a
  // different typeface size from the prose around it.
  explain: 'space-y-3 prose-ko text-[0.95rem] leading-[1.9] text-text-300',
  key: 'space-y-3 prose-ko text-prose text-text-100',
};

export function Callout({ title, children, variant = 'explain', className = '' }: CalloutProps) {
  return (
    <ExplanationCard title={title} variant={variant} className={`my-8 ${className}`}>
      <div className={BODY[variant]}>{children}</div>
    </ExplanationCard>
  );
}
