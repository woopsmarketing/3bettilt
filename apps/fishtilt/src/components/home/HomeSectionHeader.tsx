/**
 * `HomeSectionHeader` — the editorial header every band of the homepage opens with.
 *
 * A numbered eyebrow (`02 · 시작점`), the section's `<h2>` at the shared `text-h2` role, an
 * optional lead at prose measure, and an optional "see all" link that sits on the right at
 * desktop and under the lead on a phone. The number is what gives the page its running
 * order — eleven bands with eleven different layouts still read as ONE page when the
 * reader can see they are counting up.
 *
 * `SectionHeading` stays the heading for in-page sub-blocks (FAQ, tool guides); this is the
 * home's own top-of-band composition and is not a replacement for it.
 */
export interface HomeSectionHeaderProps {
  /** Running number of the band, `1..n`; printed zero-padded. */
  readonly index: number;
  readonly eyebrow: string;
  readonly title: string;
  readonly lead?: string;
  /** Optional right-aligned link. `null` href renders nothing (never a dead link). */
  readonly aside?: { readonly href: string | null; readonly label: string };
  /** The id the surrounding `<section aria-labelledby>` points at. */
  readonly id: string;
  readonly className?: string;
}

const ASIDE_LINK =
  'inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-brand-500 underline underline-offset-4 ' +
  'outline-none hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

export function HomeSectionHeader({
  index,
  eyebrow,
  title,
  lead,
  aside,
  id,
  className = '',
}: HomeSectionHeaderProps) {
  return (
    <div className={`flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between ${className}`}>
      <div className="min-w-0">
        <p className="tabular text-sm font-medium tracking-[0.08em] text-brand-500">
          <span className="font-mono">{String(index).padStart(2, '0')}</span>
          <span aria-hidden="true"> · </span>
          {eyebrow}
        </p>
        <h2 id={id} className="mt-2 prose-ko text-h2 font-semibold text-text-100">
          {title}
        </h2>
        {lead ? <p className="mt-2 max-w-lead prose-ko text-base text-text-300">{lead}</p> : null}
      </div>
      {aside !== undefined && aside.href !== null ? (
        <a href={aside.href} className={`${ASIDE_LINK} shrink-0`}>
          {aside.label}
          <span aria-hidden="true">→</span>
        </a>
      ) : null}
    </div>
  );
}
