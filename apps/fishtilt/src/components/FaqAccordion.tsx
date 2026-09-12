/**
 * `FaqAccordion` — `FaqSection` with every answer behind a native `<details>` (D-S3-12).
 *
 * A named entry point, not a second FAQ: the items, the heading, the follow-on link and
 * the `FAQPage` structured data are all `FaqSection`'s, so the block a crawler reads and
 * the block a reader opens are the same array by construction. No JavaScript — the browser
 * owns open/close, keyboard operation and the disclosure semantics.
 */
import { FaqSection, type FaqSectionProps } from './FaqSection.js';

export type FaqAccordionProps = Omit<FaqSectionProps, 'variant'>;

export function FaqAccordion(props: FaqAccordionProps) {
  return <FaqSection {...props} variant="accordion" />;
}
