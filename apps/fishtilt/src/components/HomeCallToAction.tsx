/**
 * `HomeCallToAction` — one of the homepage's prominent buttons (the two hero CTAs, and the
 * "open the full thing" link at the foot of a section).
 *
 * It exists for one reason: a CTA is the loudest promise a page makes, so it must be
 * impossible for the homepage to shout one at a destination that does not exist yet. The
 * component takes `href: string | null` — never a route id and never a path it builds
 * itself — and `null` is the ONLY way to render an unfinished destination: visible,
 * readable text with the site's established "준비 중" badge and no link semantics at all.
 * That is the same gate `RouteNavItem`, `ToolCTA`, `/learn` and `/tools` already apply; this
 * is the button-shaped member of that family, not a new rule.
 *
 * The caller resolves the `null` — through `hrefOfContent` for a content record, or through
 * the route registry's `available` for a page. Neither the caller nor this component ever
 * writes a literal path.
 *
 * A plain `<a>`, not `next/link` — see `RouteNavItem.tsx` for why this app cannot use it.
 */
export interface HomeCallToActionProps {
  /** Resolved destination, or `null` when the destination is not built yet. */
  readonly href: string | null;
  readonly label: string;
  /** `primary` is the filled brand button; `secondary` is the outlined one beside it. */
  readonly variant?: 'primary' | 'secondary';
  readonly className?: string;
}

const BASE =
  'inline-flex min-h-11 items-center justify-center rounded-md px-5 py-2.5 font-medium ' +
  'outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ' +
  'focus-visible:outline-brand-500';

const PRIMARY = 'bg-brand-600 text-ink-on-brand hover:bg-brand-hover';
const SECONDARY = 'border border-line-500 bg-panel-700 text-text-100 hover:border-brand-500';

export function HomeCallToAction({
  href,
  label,
  variant = 'primary',
  className = '',
}: HomeCallToActionProps) {
  if (href === null) {
    return (
      <span
        className={`inline-flex min-h-11 items-center gap-2 rounded-md border border-line-500 px-5 py-2.5 text-text-300 ${className}`}
      >
        {label}
        <span className="rounded-full border border-line-500 px-1.5 py-0.5 text-[10px] font-medium">
          준비 중
        </span>
      </span>
    );
  }

  return (
    <a
      href={href}
      className={`${BASE} ${variant === 'primary' ? PRIMARY : SECONDARY} ${className}`}
    >
      {label}
    </a>
  );
}
