# WP-S3-18 Independent Review — Reviewer D (Engineering / Perf / Test / Deployment)

Scope: `apps/fishtilt` + `packages/learn-core`. Read-only review; no edits made. Question: is
this safe to ship and maintainable?

## Checks run

- `pnpm --filter @gto-self/fishtilt typecheck` → exit 0, no output.
- `pnpm lint` (repo-wide) → 0 errors, 2 warnings (`no-console` in `.data/tools/seo-audit.mjs:368,433`,
  a dev-only build script, not shipped).
- `pnpm vitest run --project fishtilt --project learn-core` → **234 files / 2609 tests passed, 0 failed**.
- Read `.next/prerender-manifest.json`, `.next/routes-manifest.json`: all 22 route templates have
  `fallback: false` and 148 concrete prerendered entries → fully static, **0 server functions**
  (matches state doc's "`ƒ` 0" claim; the `dynamicRoutes` listing is the `[locale]` pattern
  template, not a runtime dynamic route).
- Diffed `docs/DEPLOY_3BETTILT.md` claims against real config: `apps/fishtilt/package.json`
  (scripts, workspace deps, no `output: 'export'`), `next.config.ts` (transpilePackages,
  single redirect, `dynamicParams=false`), root `package.json` (`packageManager pnpm@11.21.0`,
  `engines.node >=22`, root `build`/`verify` only cover `apps/web`), `.nvmrc` (`v22.22.3`),
  `pnpm-workspace.yaml`. **All match** — no drift found between doc and source.
- Grepped for `.only`/`.skip` test evasion: one `test.skip` in `range-explorer.spec.ts:74`, gated
  on `browserName !== 'chromium'` for a Chromium-only clipboard permission — legitimate, not
  suppression.
- Grepped for TODO/FIXME/XXX in `src/`: 0 hits.
- Grepped for OCR/screen-capture/input-injection/auto-play patterns (CLAUDE.md product
  boundary): 0 hits; all "screen reader" matches are accessibility-comment noise, not live-client
  code.
- Checked money handling in `features/tools/*`: uses `Money.fromBB`, `Money.mulRatio`,
  `Money.parseBB`, typed `MilliBB` throughout (`amount.ts`, `format.ts`, `requiredOuts.test.ts`)
  — no raw arithmetic on money values found.
- Checked `learn-core` for layering violations: no `react`/`@gto-self/db` imports found in
  `packages/learn-core/src`.
- Spot-checked apparent duplicate filenames (`resolve.ts` ×2, `format.ts` ×2): both pairs are
  distinct, well-documented modules for different domains/precisions (range-resolve vs.
  story-resolve; 1-decimal live calculator vs. 2-decimal frozen guide figures) — not
  accidental duplication.
- Read `not-found.tsx` and `global-error.tsx`: both deliberately hand-written (not framework
  defaults) with Korean `lang`, single `<title>`, `noindex`, and documented reasoning tied to a
  prior review finding (double `<title>` bug). `_global-error.html`'s English shell is a
  documented, unavoidable Next framework limit (synthetic route hard-wired to Next's own
  component), not a code defect.
- Read `docs/reports/stage3/handoff/WP_S3_17_HANDOFF.md` (perf/a11y, most recent WP): static
  focus-ring regression (Tailwind v4 `outline-none` + `focus-visible:outline-2` drew no ring on
  ~40 tab stops) was found and fixed with one CSS rule; wide `DataTable` mid-word breaking at
  390/320 fixed; card-wall FAQ/RelatedContent converted to ruled lists; 44px touch-target gaps
  closed; e2e 343/343 on the final build. Per-route client JS 459–651 KB, within its own budget
  test (`client-bundle.spec.ts`). This is prior work I re-verified against current green
  tests/typecheck, not new digging.

## Findings

No BLOCKER found in `apps/fishtilt` / `packages/learn-core` engineering, tests, or deploy config.

- MAJOR | test — none found beyond what's already tracked as open items in state doc.
- MINOR | lint | `apps/fishtilt/.data/tools/seo-audit.mjs:368,433` — 2 `no-console` warnings in a
  build/audit script (not part of the shipped app). Evidence: `pnpm lint` output. Low risk;
  cosmetic, fix by using the allowed `console.warn`/`error` or narrowing the eslint scope.
- NOTE | deploy | `docs/DEPLOY_3BETTILT.md` §1 already flags, correctly, that `apps/fishtilt`
  and `packages/learn-core` are git-untracked and Vercel Git import cannot build them until
  committed — this is a real pre-existing blocker for actual deployment, but it is already
  documented as an owner action item, not a doc/config inaccuracy. Confirmed still true
  (`git ls-files apps/fishtilt | wc -l` → 0 at review time, per state doc; not re-run here as
  it's stated as known and outside code review scope).
- NOTE | perf | WP-17 handoff records `/ko/tools/equity` CLS 0.059 from the worker's first
  result shifting layout — recorded as an open item for a future WP, not remediated in this
  review's scope (tool component logic, not a structural risk).
- NOTE | test quality | Copy-guard tests (`src/copy-guards.test.ts`) and content-graph tests use
  real structural assertions (regex-scanned prose classes tied to specific past defects, e.g.
  the JSX-prop Korean string leak), not tautological `toBeDefined()`-only checks, though ~101
  `toBeTruthy`/`toBeDefined` calls exist across the suite generally (not sampled individually
  for weakness — most reviewed examples were substantive).

## Verdict

Engineering, test, and deployment-doc quality are high: typecheck/lint/unit all green, build is
fully static (no server functions), CLAUDE.md money/layering/no-live-play rules are respected,
and the one prior known deploy blocker (untracked directories) is already documented rather than
hidden. Nothing here should block shipping on engineering grounds.
