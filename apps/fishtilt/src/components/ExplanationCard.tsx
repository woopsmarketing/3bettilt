/**
 * `ExplanationCard` — a callout for the beginner-facing aside a lesson or tool needs: "쉽게
 * 설명하면" boxes, worked examples, the "이 기준은 무엇인가요?" methodology notes the audit
 * calls for. Visually distinct from `Panel` (a left brand-coloured accent bar) so a reader
 * can tell "this is content" from "this is an explanation of the content" at a glance,
 * without relying on colour alone — the distinct border shape and the optional title carry
 * the same signal.
 */
export type ExplanationCardVariant = 'explain' | 'key';

export interface ExplanationCardProps {
  readonly title?: string;
  readonly children: React.ReactNode;
  /**
   * `explain` (default) is the aside described above. `key` (WP-S3-03, D-S3-13) is the
   * "핵심 정리" box an article closes a section with: the same left accent so it still reads
   * as "about the content", but on the recessed well (`ground-800`) rather than the card
   * surface, with the title in the brand ink and the body in the page ink at full weight —
   * a summary the reader is meant to keep, not an aside they may skip.
   */
  readonly variant?: ExplanationCardVariant;
  readonly className?: string;
}

const SURFACE: Readonly<Record<ExplanationCardVariant, string>> = {
  explain: 'rounded-lg border border-line-500 border-l-4 border-l-brand-500 bg-panel-700 p-6',
  key: 'rounded-lg border-l-4 border-l-brand-500 bg-ground-800 p-6',
};

const TITLE: Readonly<Record<ExplanationCardVariant, string>> = {
  explain: 'text-sm font-semibold text-text-100',
  key: 'text-sm font-semibold tracking-[0.06em] text-brand-500',
};

const BODY: Readonly<Record<ExplanationCardVariant, string>> = {
  explain: 'text-sm text-text-300',
  key: 'text-base font-medium text-text-100',
};

export function ExplanationCard({
  title,
  children,
  variant = 'explain',
  className = '',
}: ExplanationCardProps) {
  return (
    <aside data-variant={variant} className={`${SURFACE[variant]} ${className}`}>
      {title ? <p className={TITLE[variant]}>{title}</p> : null}
      <div className={`${BODY[variant]} ${title ? 'mt-2' : ''}`}>{children}</div>
    </aside>
  );
}
