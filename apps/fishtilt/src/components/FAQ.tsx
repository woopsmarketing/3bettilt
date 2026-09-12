/**
 * `FAQ` — the MDX-facing name for `FaqSection` (prompt §AP; D-S3-13).
 *
 * An article writes
 *
 *     <FAQ items={[{ question: '…', answer: '…' }]} />
 *
 * and gets the same visible block and the same `FAQPage` structured data a TSX page gets
 * from `FaqSection`, from the same array. `answer` is plain text, as `FaqSection` requires,
 * because the published answer must read character for character like the visible one.
 *
 * ## One FAQ source per article
 *
 * `src/lib/seo/faq.ts` ALSO derives a `FAQPage` block for MDX articles, from a `## 자주 묻는
 * 질문` heading followed by `###` questions. An article must use ONE of the two — either
 * the heading convention or this component — never both, or the page publishes two
 * `FAQPage` blocks with different questions. The content WPs own that choice per article;
 * this component cannot see the surrounding headings and does not try to.
 */
import { FaqSection, type FaqSectionProps } from './FaqSection.js';

export type FAQProps = FaqSectionProps;

export function FAQ(props: FAQProps) {
  return <FaqSection {...props} className={`my-12 ${props.className ?? ''}`} />;
}
