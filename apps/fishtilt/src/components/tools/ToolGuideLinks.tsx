/**
 * `ToolGuideLinks` — the onward links at the foot of a tool page, grouped under the Stage 3
 * relation labels (D-S3-16): 더 배우기 · 같이 알아둘 용어 · 이런 이야기도 있어요 · 직접 확인하기.
 *
 * ## Lists, not cards
 *
 * The six tools used to close on a two-up grid of `LinkCard`s (three lessons), and Stage 3's
 * review measured the site's hubs as "card, card, card" (D-S3-17). A guide's foot is a
 * reading list: four short groups of plain rows with a rule between them, scanned like a
 * table of contents. Rows are `min-h-11` because each one is a control.
 *
 * ## Nothing here is written by hand
 *
 * The groups come resolved from `features/tools/guideLinks.ts`; an unpublished piece arrives
 * with `href: null` and renders as the site's inert "준비 중" row — the same rule
 * `RelatedContent`, `LinkCard` and `RouteNavItem` follow — so this block can never link to
 * a page that is not there.
 */
import type { ToolGuideLinkGroup } from '../../features/tools/guideLinks.js';
import { SectionHeading } from '../SectionHeading.js';

export interface ToolGuideLinksProps {
  readonly groups: readonly ToolGuideLinkGroup[];
  /** The block's own heading. Written for the tool, never "관련 글". */
  readonly title: string;
  readonly description?: string;
  readonly className?: string;
}

const ROW_CLASS =
  'flex min-h-11 items-baseline justify-between gap-4 py-2.5 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

export function ToolGuideLinks({
  groups,
  title,
  description,
  className = '',
}: ToolGuideLinksProps) {
  if (groups.length === 0) return null;
  return (
    <section aria-label={title} className={className}>
      <SectionHeading title={title} description={description} />
      <div className="mt-6 grid gap-x-10 gap-y-8 sm:grid-cols-2">
        {groups.map((group) => (
          <section key={group.label} aria-label={group.label}>
            <h3 className="text-sm font-semibold tracking-[0.06em] text-brand-500">
              {group.label}
            </h3>
            <ul className="mt-2 divide-y divide-line-500 border-y border-line-500">
              {group.links.map((link) => (
                <li key={link.key}>
                  {link.href !== null ? (
                    <a href={link.href} className={`${ROW_CLASS} group`}>
                      <span className="prose-ko font-medium text-text-100 underline-offset-4 group-hover:text-brand-500 group-hover:underline">
                        {link.title}
                      </span>
                      {link.meta !== null ? (
                        <span className="shrink-0 text-xs text-text-300">{link.meta}</span>
                      ) : null}
                    </a>
                  ) : (
                    <span className={ROW_CLASS}>
                      <span className="prose-ko font-medium text-text-300">{link.title}</span>
                      <span className="shrink-0 rounded-full border border-line-500 px-1.5 py-0.5 text-[10px] font-medium text-text-300">
                        준비 중
                      </span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </section>
  );
}
