/**
 * `QuickAnswer` — the two-or-three-sentence direct answer at the top of a Search Guide
 * (prompt §AI; D-S3-13).
 *
 * A reader who searched "팟 오즈 계산" wants the answer before the explanation, and a
 * search engine wants a passage it can quote. This box is that passage: it sits under the
 * hero, in the recessed well with a brand label, at the prose size, and it holds prose only —
 * no list, no table, no picture. Whatever number it states should be a `<Fact>`.
 *
 * Distinct from `Callout` on purpose: a callout is an aside the reader may skip, this is
 * the thing they came for. `<aside>` would say the opposite, so it is a `<section>` named
 * by its label.
 */
export interface QuickAnswerProps {
  /** The label over the answer. Default "빠른 답". */
  readonly label?: string;
  readonly children: React.ReactNode;
  readonly className?: string;
}

const DEFAULT_LABEL = '빠른 답';

export function QuickAnswer({ label = DEFAULT_LABEL, children, className = '' }: QuickAnswerProps) {
  return (
    <section
      aria-label={label}
      className={`my-10 rounded-lg bg-ground-800 px-6 py-5 sm:px-8 sm:py-6 ${className}`}
    >
      <p className="text-sm font-semibold tracking-[0.06em] text-brand-500">{label}</p>
      <div className="mt-2 space-y-3 prose-ko text-prose font-medium text-text-100">{children}</div>
    </section>
  );
}
