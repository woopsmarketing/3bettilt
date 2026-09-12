/**
 * `Term` — the inline glossary affordance (build spec §32). The first time an article uses a
 * word, the word itself opens a short explanation and a way through to the full entry.
 *
 * ## Touch is the requirement, not an afterthought
 *
 * §32 forbids hover-only outright. So the trigger is a real `<button>` and the interaction is
 * a press: it works identically with a finger, a mouse and a keyboard, and nothing here
 * depends on a pointer that can hover.
 *
 * ## Why the native popover, and why not `<details>`
 *
 * `<details>`/`<summary>` would be the obvious native disclosure, and it is the wrong element
 * HERE for a mechanical reason rather than a stylistic one: `<details>` is FLOW content, and
 * a glossary term lives in the middle of a sentence — inside a `<p>`. A browser parsing
 * `<p>…<details>…</details>…</p>` closes the paragraph before the `<details>`, which breaks
 * the sentence in half and desynchronises the server-rendered and client-parsed trees.
 *
 * The HTML **Popover API** is the native primitive that fits: `popovertarget` on a `<button>`
 * with `popover` on a `<span>` are both PHRASING content, so the sentence stays one
 * paragraph. The browser supplies everything a hand-written popover would have to
 * reimplement and usually get wrong — the open/closed state exposed to assistive technology
 * via the invoker, light dismiss on an outside press, Escape to close, top-layer painting
 * that no `overflow: hidden` ancestor can clip, and one-open-at-a-time behaviour. It needs no
 * JavaScript of ours at all, so this stays a server component and adds nothing to the bundle
 * (§48).
 *
 * ## The link is gated, like every other link in this app
 *
 * `hrefOfContent` returns `null` until the glossary entry is actually written, and the
 * popover then shows the definition with a plain "준비 중" note instead of an anchor that
 * would 404. The definition itself still shows — that is the part the reader needed mid
 * sentence — so the affordance is useful before `/glossary` exists and becomes a doorway the
 * moment it does.
 *
 * ## One `<Term>` per term per article
 *
 * The popover's DOM id is derived from the glossary id so this component needs no client
 * state to generate one. Two uses of the same term on one page would therefore collide, which
 * is also exactly what §32 asks for ("the FIRST appearance"). `content.test.ts` enforces it
 * against the MDX rather than trusting authors to remember.
 */
import { glossaryById, hrefOfContent } from '../content/graph.js';

export interface TermProps {
  /** A glossary content id, e.g. `'term-range'`. Unknown ids throw (CLAUDE.md rule 5). */
  readonly id: string;
  /** The word as it appears in the sentence. Defaults to the entry's own title. */
  readonly children?: React.ReactNode;
}

export function popoverIdFor(termId: string): string {
  return `term-popover-${termId}`;
}

export function Term({ id, children }: TermProps) {
  const entry = glossaryById(id);
  if (entry === undefined) {
    throw new Error(`<Term id="${id}"> is not a glossary entry`);
  }
  const popoverId = popoverIdFor(id);
  const href = hrefOfContent(entry);

  return (
    <span className="relative inline">
      <button
        type="button"
        popoverTarget={popoverId}
        /*
         * `inline`, not a button's default `inline-block`: an inline-block box cannot break
         * across lines, so a multi-word Korean term would be pushed onto a line of its own
         * and leave a ragged gap in the paragraph above it.
         */
        className="inline cursor-pointer rounded-sm border-b border-dashed border-brand-500 text-text-100 underline-offset-4 outline-none hover:text-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
      >
        {children ?? entry.term}
        <span aria-hidden="true" className="ml-0.5 align-super text-[0.7em] text-brand-500">
          ⓘ
        </span>
        <span className="sr-only"> — 뜻 보기</span>
      </button>

      <span
        id={popoverId}
        popover="auto"
        /*
         * NO unconditional `block` here. A popover is hidden by the UA rule
         * `[popover]:not(:popover-open) { display: none }`, and an author-origin `display`
         * utility beats a UA-origin one whatever its specificity — setting `block` outright
         * makes every definition on the page render as a floating card over the article,
         * permanently open. `open:` is Tailwind's `:is([open], :popover-open, :open)`
         * variant, so the display is only asserted while the popover actually is open.
         */
        /*
         * `bg-scrim-900` / `shadow-raised`, not `bg-black/60` / `shadow-2xl`.
         *
         * `bg-black/60` was the last colour in the app that did not go through a token
         * (WP-1 audit §5), and it is exactly the kind that must: a 60%-black scrim over a
         * white page is a heavy grey smear, where the same popover on a dark page needs the
         * scrim to be nearly opaque to separate at all. Both values now live beside the
         * palette they belong to. Same for the shadow — invisible on the dark theme, load-
         * bearing on the light one.
         */
        className="m-auto w-[min(24rem,calc(100vw-2rem))] rounded-lg border border-line-500 bg-panel-600 p-5 text-left shadow-raised backdrop:bg-scrim-900 open:block"
      >
        <span className="block text-sm font-semibold text-text-100">{entry.title}</span>
        <span className="mt-2 block text-sm leading-[1.85] text-text-300">
          {entry.shortDefinition}
        </span>
        <span className="mt-4 flex flex-wrap items-center justify-between gap-3">
          {href !== null ? (
            <a
              href={href}
              className="inline-flex min-h-11 items-center text-sm font-medium text-brand-500 outline-none hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              자세히 보기 →
            </a>
          ) : (
            <span className="text-sm text-text-300">
              자세한 설명은
              <span className="mx-1 rounded-full border border-line-500 px-1.5 py-0.5 text-[10px] font-medium">
                준비 중
              </span>
              입니다
            </span>
          )}
          <button
            type="button"
            popoverTarget={popoverId}
            popoverTargetAction="hide"
            className="inline-flex min-h-11 cursor-pointer items-center rounded-md border border-line-500 px-3 text-sm text-text-100 outline-none hover:border-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            닫기
          </button>
        </span>
      </span>
    </span>
  );
}
