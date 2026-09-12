/**
 * `CtaBand` — the one call to action a page is allowed to shout (D-S3-12).
 *
 * A brand-tinted band (`brand-950`) with a title, one sentence, a primary button and an
 * optional secondary link. It is what replaces "a card with a button in it" at the foot of
 * a hub or a lesson, and the brand tint is spent here precisely so it means something: a
 * page with two of these has no call to action at all.
 *
 * The band draws no borders on the tint — `line-500` is not audited against `brand-950` (see
 * `Section`) — and its button is the site's primary button verbatim (`bg-brand-600` +
 * `ink-on-brand`, hover `brand-hover`), the same class string `ToolCTA` uses, so the two
 * cannot drift. `href: null` renders the established "준비 중" treatment rather than a link
 * that 404s, exactly as `ToolCTA` and `LinkCard` do.
 *
 * Full-bleed when placed directly in a page; inside a `Section` it fills the section's
 * inner box. Either way it is rounded only when `rounded` is set, because a full-bleed
 * band with rounded corners looks like a very large card.
 */
export interface CtaBandAction {
  readonly href: string | null;
  readonly label: string;
}

export interface CtaBandProps {
  readonly title: string;
  readonly description?: string;
  readonly primary: CtaBandAction;
  readonly secondary?: CtaBandAction;
  readonly rounded?: boolean;
  readonly className?: string;
}

const PRIMARY_CLASS =
  'inline-flex min-h-11 items-center rounded-md bg-brand-600 px-5 py-2.5 font-medium text-ink-on-brand outline-none hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

const SECONDARY_CLASS =
  'inline-flex min-h-11 items-center px-2 py-2.5 font-medium text-brand-500 underline underline-offset-4 outline-none hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

const PLANNED_CLASS =
  'inline-flex min-h-11 items-center gap-2 rounded-md px-5 py-2.5 text-text-300 outline outline-1 outline-text-300';

function Action({ action, kind }: { readonly action: CtaBandAction; readonly kind: 'primary' | 'secondary' }) {
  if (action.href === null) {
    return (
      <span className={PLANNED_CLASS}>
        {action.label}
        <span className="rounded-full px-1.5 py-0.5 text-[10px] font-medium outline outline-1 outline-text-300">
          준비 중
        </span>
      </span>
    );
  }
  return (
    <a href={action.href} className={kind === 'primary' ? PRIMARY_CLASS : SECONDARY_CLASS}>
      {action.label}
    </a>
  );
}

export function CtaBand({
  title,
  description,
  primary,
  secondary,
  rounded = false,
  className = '',
}: CtaBandProps) {
  return (
    <div
      className={`bg-brand-950 px-6 py-10 sm:px-10 sm:py-12 ${rounded ? 'rounded-xl' : ''} ${className}`}
    >
      <div className="mx-auto flex max-w-breakout flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="prose-ko text-2xl font-semibold text-text-100">{title}</p>
          {description ? (
            <p className="mt-2 max-w-lead prose-ko text-base text-text-300">{description}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <Action action={primary} kind="primary" />
          {secondary ? <Action action={secondary} kind="secondary" /> : null}
        </div>
      </div>
    </div>
  );
}
