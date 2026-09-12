/**
 * `FaqSection` — a real, visible question-and-answer block.
 *
 * ## One array, two consumers
 *
 * `src/lib/seo/faq.ts` exists because `FAQPage` structured data is only legal when the
 * questions it declares are actually on the page, and the only way to guarantee that is to
 * derive the markup from what the page renders. For MDX that means re-parsing the article's
 * own headings. TSX pages have no MDX to re-parse, so the equivalent guarantee here is a
 * single array: the caller declares `items` once, this component renders them, and WP-7
 * builds the `FAQPage` block from the SAME array. That is the pattern `Breadcrumbs` already
 * uses — one list produces both the visible trail and the `BreadcrumbList`.
 *
 * The item type is `lib/seo/faq.ts`'s own `FaqItem`, imported rather than redeclared, so the
 * two halves cannot drift into two shapes. `answer` is therefore PLAIN TEXT with no markup:
 * a `FAQPage` answer is a string, and anything richer would be the exact drift this module
 * was written to prevent. A follow-on link is carried beside the answer in `link`, outside
 * the text, so the rendered page can point somewhere without the structured data claiming an
 * answer that reads differently from the one on screen (FISHTILT_STATE ruling 107).
 *
 * ## WP-7a: the `FAQPage` block is emitted HERE, from that same array
 *
 * WP-3 left this to WP-7 and WP-7 put it in the component rather than in the seven pages that
 * use it, for the reason `Breadcrumbs` gives: a block built at the call site is a second copy
 * of the list, and a second copy drifts. Here the `<script>` is a serialisation of the very
 * `items` the `<ul>` below renders — `question` is the `<h3>` a reader sees and `answer` is
 * the `<p>` under it, character for character, because both are rendered as plain text with
 * no interpolation. There is no code path that can publish a question this section does not
 * show, and a page that adds a `FaqSection` gets its structured data with it.
 *
 * The MDX pipeline's `MIN_FAQ_ITEMS` rule applies to the markup here too: a block of one
 * question is an aside rather than a FAQ, so it renders (the reader asked for it) and
 * publishes nothing. One rule, both pipelines.
 *
 * ## Why the answers are not collapsed by default
 *
 * `<details>` is the correct accordion and the DEFAULT does not use it: a block of six short
 * answers has nothing to hide, hiding them puts the site's honesty statements one click away
 * from a reader who is deciding whether to trust the site, and text a crawler has to open is
 * text a crawler may not weigh. Every answer is visible, and there is nothing interactive in
 * the block except the optional link, which keeps it out of the 44px-target rules that
 * govern controls.
 *
 * ## WP-S3-03: the `accordion` variant, same array, same block
 *
 * Stage 3's layout brief lists "FAQ accordion" as one of the rhythms a long page may use
 * (D-S3-12), for the foot of a hub or a Search Guide with a dozen questions. It is a
 * VARIANT of this component, not a second one, because the guarantee above — the published
 * `FAQPage` is a serialisation of the very items on screen — must not be re-implemented.
 * `variant="accordion"` wraps each item in a native `<details>`/`<summary>` (no JavaScript,
 * no `aria-expanded` to manage, keyboard-operable by the browser), the `<h3>` becomes the
 * summary's content, and the answer `<p>` is the same element with the same text — closed
 * by default, in the DOM either way. `FaqAccordion` is the named entry point onto it. The
 * `open` default is unchanged, so every page that renders this today still shows every
 * answer, and the "nothing collapsed" test below still holds for it.
 *
 * A plain `<a>`, not `next/link` — see `RouteNavItem.tsx` for why this app cannot use it.
 * `link.href` is `string | null` for the same reason every other destination on this site
 * is: the caller resolves it through the route registry or `hrefOfContent`, and `null`
 * simply renders no link rather than a promise to a page that does not exist.
 */
import type { FaqItem } from '../lib/seo/faq.js';
import { faqPageJsonLd, JsonLd, MIN_FAQ_ITEMS } from '../lib/seo/index.js';
import { SectionHeading } from './SectionHeading.js';

export interface FaqEntry extends FaqItem {
  /** An optional "go and read the rest" link, rendered after the answer and never part of
   *  the answer text. Omitted entirely when the destination is `null`. */
  readonly link?: {
    readonly href: string | null;
    readonly label: string;
  };
}

export type FaqVariant = 'open' | 'accordion';

export interface FaqSectionProps {
  readonly items: readonly FaqEntry[];
  /** The section's own heading, and its accessible name as a region. */
  readonly title?: string;
  readonly description?: string;
  /** `open` (default) shows every answer; `accordion` puts each behind a native `<details>`. */
  readonly variant?: FaqVariant;
  readonly className?: string;
}

const DEFAULT_TITLE = '자주 묻는 질문';

const LINK_CLASS =
  'inline-flex min-h-11 items-center text-sm font-medium text-brand-500 underline underline-offset-4 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

function FollowOn({ link }: { readonly link: FaqEntry['link'] }) {
  if (link === undefined || link.href === null) return null;
  return (
    <p className="mt-1">
      {/* `min-h-11`: this link stands on its own line rather than inside a sentence, so it
          is a standalone control and owes the 44px touch target every other standalone
          control on this site meets (WP-O1). */}
      <a href={link.href} className={LINK_CLASS}>
        {link.label}
      </a>
    </p>
  );
}

export function FaqSection({
  items,
  title = DEFAULT_TITLE,
  description,
  variant = 'open',
  className = '',
}: FaqSectionProps) {
  // A heading over an empty list is a promise of content that is not there.
  if (items.length === 0) return null;

  // The `link` is deliberately dropped on the way into the block: it is rendered BESIDE the
  // answer, not inside it, so publishing it would make the structured answer longer than the
  // one on screen. `question` and `answer` travel verbatim.
  const published =
    items.length >= MIN_FAQ_ITEMS
      ? items.map(({ question, answer }) => ({ question, answer }))
      : [];

  return (
    <section aria-label={title} data-variant={variant} className={className}>
      <SectionHeading title={title} description={description} />
      <JsonLd blocks={[faqPageJsonLd(published)]} />
      {variant === 'accordion' ? (
        // A rule between items, not a card around each: the accordion is a list of
        // questions a reader scans, and a border per row would be the card wall again.
        <ul className="mt-6 divide-y divide-line-500 border-y border-line-500">
          {items.map((item) => (
            <li key={item.question}>
              <details className="group">
                {/* `min-h-11`: the summary IS the control. `list-none` + the marker below
                    replace the UA triangle with one that follows the theme tokens. */}
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-4 outline-none marker:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 [&::-webkit-details-marker]:hidden">
                  <SectionHeading as="h3" title={item.question} />
                  <span
                    aria-hidden="true"
                    className="shrink-0 text-lg leading-none text-text-300 transition-transform duration-150 group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <div className="pb-5">
                  <p className="prose-ko text-[0.9375rem] text-text-300">{item.answer}</p>
                  <FollowOn link={item.link} />
                </div>
              </details>
            </li>
          ))}
        </ul>
      ) : (
        // WP-S3-17: a ruled list, not a stack of bordered boxes. Six questions in six cards
        // was the card wall D-S3-17 forbids, and it was the LAST thing on the home page and
        // every tool page — the reader's final impression. The same hairline the accordion
        // draws, with the question set as a heading and the answer as prose beneath it: a
        // FAQ reads like a page of a magazine, not like a settings screen.
        <ul className="mt-6 divide-y divide-line-500 border-y border-line-500">
          {items.map((item) => (
            <li key={item.question} className="py-5 sm:py-6">
              <SectionHeading as="h3" title={item.question} />
              <p className="prose-ko mt-2 max-w-reading text-[0.9375rem] text-text-300">
                {item.answer}
              </p>
              <FollowOn link={item.link} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
