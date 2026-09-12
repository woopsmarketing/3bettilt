/**
 * `ToolPageFooter` — what every tool page ends with, after its guide: the FAQ (the real
 * next-questions, published as `FAQPage` by `FaqSection` itself, so the block is only ever
 * emitted for questions a reader can see), the grouped onward links (D-S3-16 labels), and the
 * hand-off to the next tool. One component so the six pages end in the same order and the
 * same rhythm, and so a page cannot forget the links or the hand-off.
 */
import type { FaqEntry } from '../FaqSection.js';
import { FaqSection } from '../FaqSection.js';
import { Section } from '../Section.js';
import { toolGuideLinkGroups } from '../../features/tools/guideLinks.js';
import { TOOL_FAQ_TITLE } from '../../features/tools/faq.js';
import { ToolGuideLinks } from './ToolGuideLinks.js';

export interface ToolPageFooterProps {
  readonly routeId: string;
  readonly faq: readonly FaqEntry[];
  readonly faqDescription: string;
  readonly linksTitle: string;
  readonly linksDescription?: string;
  /** The `ToolCTA`(s) to the next tool. */
  readonly children?: React.ReactNode;
}

export function ToolPageFooter({
  routeId,
  faq,
  faqDescription,
  linksTitle,
  linksDescription,
  children,
}: ToolPageFooterProps) {
  return (
    <>
      <Section width="reading" padded="compact" divider="top" as="div">
        <FaqSection title={TOOL_FAQ_TITLE} description={faqDescription} items={faq} />
      </Section>
      <Section width="breakout" padded="compact" tone="recessed" as="div">
        <ToolGuideLinks
          groups={toolGuideLinkGroups(routeId)}
          title={linksTitle}
          description={linksDescription}
        />
      </Section>
      {children !== undefined ? (
        <Section width="shell" padded="compact" as="div">
          {children}
        </Section>
      ) : null}
    </>
  );
}
