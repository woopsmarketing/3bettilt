/**
 * `ToolCTA` — the in-article call to action (build spec §75). Not "Range Explorer로 이동" at
 * the bottom of the page: a sentence in the reader's own moment ("직접 BTN과 UTG를 비교해
 * 보세요") followed by a link that opens the tool ALREADY in the state the article was
 * talking about.
 *
 * ## The deep link is data, not a string
 *
 * `tool` is a route id from `src/lib/routes.ts` and `params` is a plain object; `toolHref`
 * assembles `/tools/range?hero=BTN&spot=RFI&stack=100` through `URLSearchParams`. An article
 * therefore cannot hard-code a path that a later route rename would silently break, and
 * cannot inject anything into the query string. Route ids are checked against the registry by
 * `content.test.ts`.
 *
 * ## Before the tool exists
 *
 * `toolHref` returns `null` for a route the registry says is not built yet, and this renders
 * the same visible, non-interactive "준비 중" treatment `RouteNavItem` uses for nav — readable
 * text, no link semantics, nothing that 404s. When the tool ships, flipping `available` in
 * the route registry turns every CTA that pointed at it into a live deep link with no content
 * edit at all. That is the whole reason the id indirection exists.
 */
import { toolHref, toolRoute } from '../content/graph.js';

export interface ToolCTAProps {
  /** Route id from `src/lib/routes.ts` — `'range'`, `'toolPotOdds'`, … Never a path. */
  readonly tool: string;
  /** Query parameters the tool should open with. Encoded, never interpolated. */
  readonly params?: Readonly<Record<string, string>>;
  /** The contextual sentence. Written for this spot in this article, not generic. */
  readonly title: string;
  /** One extra line of "what you will see". Optional. */
  readonly children?: React.ReactNode;
  /** The button's own words. Defaults to the route's nav label. */
  readonly action?: string;
  readonly className?: string;
}

export function ToolCTA({ tool, params, title, children, action, className = '' }: ToolCTAProps) {
  const route = toolRoute(tool);
  const href = toolHref(tool, params);
  const label = action ?? `${route.label} 열기`;

  return (
    <aside
      className={`my-10 rounded-lg border border-line-500 border-l-4 border-l-brand-500 bg-panel-700 p-6 ${className}`}
    >
      <p className="text-base font-semibold text-text-100">{title}</p>
      {children ? <div className="mt-2 text-sm text-text-300">{children}</div> : null}

      <div className="mt-5">
        {href !== null ? (
          <a
            href={href}
            className="inline-flex min-h-11 items-center rounded-md bg-brand-600 px-5 py-2.5 font-medium text-ink-on-brand outline-none hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            {label}
          </a>
        ) : (
          <span className="inline-flex min-h-11 items-center gap-2 rounded-md border border-line-500 px-5 py-2.5 text-text-300">
            {label}
            <span className="rounded-full border border-line-500 px-1.5 py-0.5 text-[10px] font-medium">
              준비 중
            </span>
          </span>
        )}
      </div>
    </aside>
  );
}
