# FISHTILT WP-A — design system, app shell, card primitives

Delivered by a fresh-context agent; **independently re-verified by the orchestrator**,
including a contrast re-measurement from the token file and a look at the actual rendered
page at desktop and phone widths.

## What shipped (`apps/fishtilt/`)

- `src/lib/routes.ts` — a typed route registry (path, Korean label, section, `available`).
- `src/components/` — `PokerCard`, `CardPicker`, `Panel`, `SectionHeading`, `PageHero`,
  `ExplanationCard`, `RouteNavItem`, `SiteHeader`, `SiteFooter`, each with co-located tests.
- `src/app/globals.css` — contrast audit and fixes, a new `--color-suit-red-500`, and a
  global `prefers-reduced-motion` reset.
- `src/app/layout.tsx` — header and footer wired around the page.

## The honest-navigation mechanism

A nav link to a page that 404s is a broken promise; a nav that hides everything unbuilt
makes the product look empty. So every destination is in the registry with an `available`
flag: available entries render as real links, unavailable ones render as inert Korean text
with a "준비 중" pill and **no** link or button semantics — not a disabled control, not a
dead `href`.

The load-bearing part is the test: **every entry marked `available: true` must have a real
`page.tsx` on disk.** That makes it impossible to mark something available that is not.
Today only `/` qualifies, which is why the header currently shows five "준비 중" pills. They
flip as work packages land.

## Contrast — re-measured by the orchestrator, not taken on trust

Both changed tokens and every claimed ratio were recomputed independently from
`globals.css` using the WCAG relative-luminance formula. The agent's table reproduced
exactly.

| Pair | Ratio | Requirement | Verdict |
| --- | --- | --- | --- |
| `text-100` on `ground-900` | 18.29:1 | 4.5 | pass |
| `text-300` on `ground-900` | 7.24:1 | 4.5 | pass |
| `text-500` on `ground-900` | 3.74:1 | 4.5 body / 3.0 large | **fails body**, passes large/UI |
| `brand-500` on `ground-900` | 5.50:1 | 4.5 | pass |
| `line-500` border on `ground-900` | 3.44:1 | 3.0 | pass — **was 1.45:1, fixed** |
| `line-500` border on `panel-700` | 3.15:1 | 3.0 | pass — was 1.33:1, fixed |
| `text-100` on `brand-600` fill | 4.70:1 | 4.5 | pass — **was 4.10:1, fixed** |
| `suit-red-500` on `panel-600` / `ground-900` | 5.23 / 6.12:1 | 4.5 | pass |

Two token values changed: `--color-line-500` `#292e36 → #5c6774` (borders were effectively
invisible) and `--color-brand-600` `#e9203a → #d71e36` (light text on the brand fill was
below AA). The brand red itself, `#ff334d`, is unchanged — it is the identity and it
already passed.

`--color-text-500` deliberately keeps its sub-AA value and is now documented as usable only
for large text, disabled states and decorative meta — never body copy. The agent correctly
flagged that the scaffold homepage violated this rule; **the orchestrator fixed it**
(`page.tsx` table headers moved to `text-300`), since that file was outside the agent's
boundary. No `text-text-500` usage remains anywhere in the app.

## The card contrast trap, and how it was solved

Cards render on the app's own dark surface rather than a white face, to stay consistent
with the "education site, not casino skin" direction. That makes both suit colours a
problem: pure black ♠♣ on near-black is invisible, and pure red ♥♦ on near-black is close
to it. Spades and clubs therefore use the page's light ink (18.3:1), and hearts and
diamonds use a dedicated `--color-suit-red-500` kept distinct from the brand red — for the
same reason the strategy-action scale is kept distinct from the brand scale.

## Visual QA performed by the orchestrator

The production build was served and photographed at 1440×1000 and 390×844.

- Desktop reads as intended: dark, calm, high contrast, no casino signalling, real numbers.
- The first-in table shows 17.0 / 21.1 / 27.8 / 42.8 / 46.9% for UTG→SB — monotonically
  widening by position, which is the behaviour the underlying data should produce, and a
  useful sanity signal that the range wiring is right.
- **One real defect was found that no test caught**: at phone width the first two table
  headers collided ("내 위치사용하는 패"). Fixed by the orchestrator with column padding and
  `whitespace-nowrap`, then re-photographed to confirm.

This is the reason the build spec asks for visual QA separately from tests: every automated
gate was green while that collision was on screen.

## Accepted judgement calls

- **`next/link` is not used.** It does not resolve under this app's `nodenext` + ESM config
  (TS2307) — the constraint `apps/web/tsconfig.json` already documents at length. The agent
  followed the existing precedent in `apps/web` and used plain anchors. This trades
  client-side navigation for full page loads; for a static, SEO-oriented content site that
  is an acceptable cost, and it is the repository's existing decision rather than a new one.
  Revisit only if measured navigation feel becomes a problem.
- **"핸드레인지" points at `/tools/range`.** Correct per build spec §6 and §7: the 13×13
  explorer is the flagship and gets its own primary-nav slot, separate from "무료 도구".
- The registry carries more routes than the header renders today, seeded from the full route
  map. Harmless: unrendered entries cannot affect the availability property.

## Verification

| Gate | Result |
| --- | --- |
| `pnpm vitest run --project fishtilt` | 58 passed, 12 files |
| `pnpm --filter @gto-self/fishtilt typecheck` | pass |
| `npx eslint apps/fishtilt --max-warnings=0` | pass, 0 warnings |
| `pnpm build:fishtilt` | pass — `/` still prerenders **static** |
| `pnpm e2e:fishtilt` | 10 passed (was 4) |
| Full `pnpm vitest run` (agent) | 2730 passed, 164 files, no regressions |
| Orchestrator re-run after fixes | tests 58, e2e 10, build static — all pass |

E2E grew from 4 tests to 10: a 5-viewport overflow matrix, a mobile-nav-open overflow
check, and a keyboard-focus-visibility check. The one pre-existing assertion that had to
change was the brand-text query, which became ambiguous once the wordmark appeared in both
header and footer; it was made **more** precise (scoped to the banner's link), not weaker.
No assertion was deleted.

## Not verified

- Real assistive-technology behaviour. Only DOM roles and ARIA attributes were asserted; no
  live screen-reader pass. Carried to WP-L2.
- Real-device touch targets. Only the 44px CSS classes were asserted, not measured on
  hardware.
- `act-fold-500` as a border on `ground-900` measures 1.93:1 and would fail if used that
  way. It is currently unused; WP-C owns it when the matrix lands.
