/**
 * `LinkCard` — the site's ONE "here is a thing you can go read" card.
 *
 * ## Why this exists
 *
 * Seven surfaces were rendering the same card: the homepage and the six hubs `/learn`,
 * `/blog`, `/glossary`, `/hands`, `/tools`, `/practice`, each with its own copy of the markup
 * down to the identical `rounded-lg border border-line-500 bg-panel-700` class string and its
 * own copy of the "준비 중" branch (WP-1 audit §5, "카드 마크업 6배 중복").
 * Six copies means every future design change costs six edits and drifts on the seventh, and
 * the honesty branch — the one that decides whether an unbuilt thing renders as a link — was
 * duplicated six times in a codebase whose whole point is that it never links to a 404.
 *
 * The homepage's card was already exactly this component under an earlier name. WP-2 left it
 * as a thin alias because `src/app/page.tsx` belonged to another work package; WP-3 rebuilt
 * the homepage on this component and deleted the alias. `LinkCard.test.tsx` asserts, over the
 * filesystem, that a second card file has not reappeared.
 *
 * ## Why it takes `href: string | null` and nothing else
 *
 * A card that could build its own path would be the site's most reliable source of dead
 * links. It cannot: the caller resolves the destination through `hrefOfContent` (which returns
 * `null` for a `PLANNED` record) or through the route registry's `available` flag (which
 * `routes.test.ts` checks against the filesystem), and hands the answer over already resolved.
 *
 * `null` renders the site's established "준비 중" treatment — readable text, a badge, and no
 * link or button semantics whatsoever, so it is neither a link that 404s nor a disabled
 * control someone might wonder how to enable. `RouteNavItem` renders the same treatment for
 * navigation, deliberately identical so a reader learns the badge once.
 *
 * Renders an `<li>`: every caller is a list, and a list of destinations should be a list.
 *
 * A plain `<a>`, not `next/link` — see `RouteNavItem.tsx` for why this app cannot use it.
 */
export interface LinkCardProps {
  /** Resolved destination, or `null` when this thing exists as a plan, not yet as a page. */
  readonly href: string | null;
  readonly title: string;
  /** The record's own one-line description, or the tool's. Optional. */
  readonly description?: string | null;
  /** Small print under the description — `contentMeta(record)`, a route label, a kind. */
  readonly meta?: string | null;
  /** Small print ABOVE the title — a lesson number, a hand key, a kind label. Optional. */
  readonly eyebrow?: string | null;
  /**
   * A visual for the top of the card — a generated thumbnail, a mini matrix, a diagram.
   *
   * Deliberately a slot and not an `imageUrl`: `ContentRecord` has no image field and
   * FISHTILT_STATE ruling 112 settles that a card's visual is rendered, not a raster with
   * burned-in Korean text. WP-5 fills it on `/blog` with `ContentThumbnail`. Nothing is
   * rendered when it is omitted — no placeholder box, no reserved height — so the four hubs
   * that pass no visual (`/glossary`, `/hands`, `/tools`, `/practice`) look exactly as they
   * did before this slot existed.
   */
  readonly visual?: React.ReactNode;
  /**
   * Short category labels above the title — the record's `topic`, a level, a section.
   *
   * LABELS, not links. The whole card is one `<a>` (see the header), so a chip that
   * navigated somewhere else would be an anchor inside an anchor: invalid HTML, and a
   * browser would flatten it into something neither destination expects. A reader who wants
   * every article on a topic scrolls to that topic's group on `/blog`, which is a heading,
   * not a filter.
   *
   * Rendered as `<span>`s inside the card's own text flow rather than as a positioned
   * overlay on the visual, because the visual is `aria-hidden` decoration and a chip is
   * content — putting content on top of decoration would make the chip disappear for anyone
   * whose images or colours resolve differently than expected.
   */
  readonly chips?: readonly string[];
  /**
   * `comfortable` (default) is the reading-list card: `/learn`, `/blog`, `/tools`,
   * `/practice`. `compact` is the two-up index card that is scanned rather than read:
   * `/glossary`'s 58 terms and `/hands`'s 20 hands.
   */
  readonly density?: 'comfortable' | 'compact';
  readonly className?: string;
}

const PADDING = { comfortable: 'p-5', compact: 'p-4' } as const;

/** The card's own surface. One string, used by both branches, so the linked and the
 *  unavailable card can never drift apart visually. */
const SURFACE = 'rounded-lg border border-line-500 bg-panel-700';

/**
 * One chip. `panel-600` is the next surface up the elevation ladder, so a chip reads as a
 * small raised label on the card rather than as a hole in it, and it keeps working when the
 * card itself lifts to `panel-600` on hover because the border carries the shape.
 */
const CHIP =
  'inline-block rounded-sm border border-line-500 bg-panel-600 px-2 py-0.5 text-xs text-text-300';

export function LinkCard({
  href,
  title,
  description = null,
  meta = null,
  eyebrow = null,
  visual = null,
  chips = [],
  density = 'comfortable',
  className = '',
}: LinkCardProps) {
  const padding = PADDING[density];

  const body = (
    <>
      {visual !== null ? <span className="mb-4 block">{visual}</span> : null}
      {chips.length > 0 ? (
        <span className="mb-2 flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <span key={chip} className={CHIP}>
              {chip}
            </span>
          ))}
        </span>
      ) : null}
      {eyebrow !== null ? (
        <span className="tabular block font-mono text-xs text-brand-500">{eyebrow}</span>
      ) : null}
      <span className={`block font-semibold text-text-100 ${eyebrow !== null ? 'mt-1.5' : ''}`}>
        {title}
      </span>
      {description !== null ? (
        <span className="mt-2 block text-sm text-text-300">{description}</span>
      ) : null}
      {meta !== null ? <span className="mt-2 block text-xs text-text-300">{meta}</span> : null}
    </>
  );

  if (href === null) {
    return (
      <li className={`${SURFACE} ${padding} ${className}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">{body}</div>
          <span className="shrink-0 rounded-full border border-line-500 px-1.5 py-0.5 text-[10px] font-medium text-text-300">
            준비 중
          </span>
        </div>
      </li>
    );
  }

  return (
    <li className={className}>
      {/*
       * The hover lifts the card's SURFACE as well as its border. On a dark UI a border alone
       * is most of what a card is, so a border-only hover reads as "something flickered";
       * moving to the next surface up the elevation ladder reads as the card coming forward.
       * Both halves are token moves, so the same gesture works in the light theme, where the
       * card is white and the hover tint is the one that is slightly grey.
       */}
      <a
        href={href}
        className={`block h-full ${SURFACE} ${padding} outline-none transition-colors duration-150 hover:border-brand-500 hover:bg-panel-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500`}
      >
        {body}
      </a>
    </li>
  );
}
