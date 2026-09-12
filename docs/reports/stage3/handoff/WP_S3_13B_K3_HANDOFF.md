# WP-S3-13b — hands content batch K3

## Objective

Enrich the 5 K3 starting-hand pages (`aks`, `ako`, `aqs`, `aqo`, `ajs`) on the finished
WP-S3-13a template: remove MDX prose that now duplicates template-rendered Facts (fact strip,
§3 definition, §5 strength + comparison table, §6 RFI seats), add a real `## 자주 묻는 것` FAQ
(≥2 `### 질문?`), and close the batch's NUMBER-RISK items with executable test pins.

## Facts verified before work

- Template (`src/app/[locale]/hands/[hand]/page.tsx`) already renders combos/share/one-in-n
  (§3), rank/top-share/equity + `HandComparisonTable` (rank ±2 + s/o twin, §5), RFI seats (§6)
  — MDX's job is hook + context + FAQ only (13a handoff how-to).
- `readFaqItems`/`extractFaqItems` (`src/lib/seo/faq.ts`) require `## 자주 묻는 것` (or "자주
  헷갈리는"/"자주 하는 질문") with ≥2 `###` sub-headings whose answers contain **no** JSX
  component (a `<Fact>`/`<Term>` in an answer drops that pair).
- `batchGate.ts` (shared, unmodified) pins: registry shape, MDX map registration, threshold
  (`minProseCharacters: 600`, `minSections: 3`, `minComponents: 1`), `readMinutes ===
  estimateReadMinutes(...)`, `<Term>`/`<PokerCards>`/`<Fact>` validity, no bare 169/1,326, no
  GTO/profitability-verdict/always-must language, and 4 ruling-28 comparative-claim tests
  (already present: AKo vs 77/66, AKo best-offsuit-of-169, AJs > AKo, AQo > KQs).
- Audit (`3BETTILT_CONTENT_AUDIT.md` §5, §6.1 #4–#6) named 3 unpinned narrative rank claims in
  this batch: ako's "바로 위 AJs, 바로 아래 ATs" (#4), aqo's "13·15위 모두 A 포함" (#5), aqs's
  "AKs와 AQs 사이 유일한 자리는 77" (#6).

## Decisions made

- Removed all "얼마나 자주" frequency paragraphs (duplicate of §3's `HAND_ONE_IN_N`) and all
  explicit rank/combo/equity `<Fact>` restatements of hands already in `HandComparisonTable`'s
  ±2 window (e.g. ako's AKs-vs-AKo combo/equity paragraph, aqs's AJs/AQo equity restatement).
  Kept only Facts/claims NOT covered by the table: ako's "best offsuit of all 169" (global
  scan, not a ±2 neighbour fact) and aqo's "outranks KQs" (cross-family, not a neighbour).
- Kept qualitative/narrative context (misconceptions, "why", s/o notation) since that is the
  MDX's actual job per the 13a how-to; rewrote it to reference "위 비교 표" instead of
  re-typing the numbers the table already shows.
- Added `## 자주 묻는 것` with exactly 3 `### ...?` questions per file, answers as plain
  prose (no `<Fact>`/`<Term>`), no table-action prescriptions.
- Left `relatedArticles: []` for aqs/aqo/ajs (audit explicitly calls this optional — exposed
  via back-reference already) and left `relatedTools`/`relatedConcepts` untouched: audit's
  suggested tool re-selection conflicts with `batchGate.ts`'s
  `arrayContaining(['toolStartingHand','toolEquity'])` requirement, and `batchGate.ts` is out
  of my file boundary, so no change was made (matches 13a handoff's own note on this).

## Files changed

- `apps/fishtilt/content/hands/{aks,ako,aqs,aqo,ajs}.mdx` — rewritten prose per hand.
- `apps/fishtilt/src/content/registry/hands/k3.ts` — `readMinutes`: ako 3→2 (only numeric
  change; no other record touched).
- `apps/fishtilt/src/content/registry/hands/k3.test.ts` — added 3 new pinned tests (below).
- This handoff.

## NUMBER-RISK closed (§6.1)

- **#4** (ako "바로 위 AJs, 바로 아래 ATs"): now stated generically ("둘 다 수티드"), pinned by
  new test `AKo's immediate rank neighbours are both suited` (`HAND_AT_RANK(rank-1)` and
  `(rank+1)` both match `/s$/`).
- **#5** (aqo "13·15위 모두 A"): now stated generically ("에이스가 촘촘히"), pinned by new test
  `AQo's immediate rank neighbours both include an ace` (`HAND_AT_RANK` both match `/^A/`).
- **#6** (aqs "AKs와 AQs 사이 유일한 자리는 77"): kept as prose (names 77, no numbers), pinned
  by new test `exactly one class (77) sits between AKs and AQs in rank`
  (`rank('AQs') === rank('AKs') + 2` and `HAND_AT_RANK(rank('AKs')+1) === '77'`).
- Pre-existing pins retained unchanged: AKo vs 77/66, AKo best-offsuit-of-169, AJs > AKo,
  AQo > KQs.

## Tests run

- `pnpm vitest run --project fishtilt src/content/registry/hands/k3.test.ts` → **25/25 PASS**.
- `pnpm vitest run --project fishtilt src/content src/app/[locale]/hands src/copy-guards.test.ts`
  → 633 passed / 3 failed, **none in K3's files**: `hand-kqs` readMinutes mismatch (K4's file,
  `content.test.ts` + `k4.test.ts`) and a leftover `registry/hands/__scratch_dump.test.ts`
  debug file dumping strength-table values (also under K4's batch, not created by me) —
  reported here for the orchestrator, not fixed (outside my file boundary).
- `pnpm --filter @gto-self/fishtilt typecheck` → 0 errors touching K3 files.
- `pnpm exec eslint apps/fishtilt/src/content/registry/hands/k3.ts
  apps/fishtilt/src/content/registry/hands/k3.test.ts` → clean.

## Build/runtime evidence

- `build-lock.sh 'pnpm build && next start :3221 && shoot.mjs'` → build rc 0, all 142 static
  routes generated, including `/ko/hands/aks,ako,aqs,aqo,ajs`.
- Screenshots (`artifacts/3bettilt-stage3-visual-qa/wp13b-K3/`, 16 files): `ko_hands_aqs` and
  `ko_hands_ajs` × 1440x900/390x844 × dark/light (+fold). All shots: `h1` count 1, `overflowX`
  0, `<main>` width 736 (desktop, reading column) / 390 (mobile, full width).
- Visually inspected all 4 full-page shots: fact strip, 13×13 highlight, comparison table
  ("이웃한 패와 나란히 보면"), RFI seat diagram, FAQ section, and the 4 RelatedContent groups
  all render correctly in both themes with no duplicated Fact paragraphs and no overflow.

## Known limitations

- `aqs`/`aqo`/`ajs` keep `relatedArticles: []` — optional per audit; not filled because the
  candidate blog slugs in the audit's B01/B04/B08 shorthand were not resolvable to real
  registry ids without guessing (out of scope to invent).
- Prose length is close to the 600-char floor for aqs/aqo/ajs (thin by design per the 13a
  "quick reference, no padding" instruction); any further trimming would need a
  `unmetIndexRequirements` re-check.

## Open issues (out of my boundary — reporting only)

- `apps/fishtilt/src/content/registry/hands/k4.test.ts` / `content.test.ts`: `hand-kqs`
  readMinutes recorded as 2, computed as 3 — K4's file, needs that agent's fix.
- `apps/fishtilt/src/content/registry/hands/__scratch_dump.test.ts`: a debug scratch file left
  in the shared `registry/hands/` directory (not `.test.` boundary of mine, not created by me)
  asserting `''` against a dump of strength-table values — currently failing and should be
  deleted by whoever left it (looks like K4's or K2's debugging artifact).

## Exact facts next agent may rely on

- K3's 5 MDX files + `k3.ts` + `k3.test.ts` are internally consistent and green in isolation
  (`k3.test.ts` 25/25).
- The 3 new comparative-claim tests in `k3.test.ts` use only `factValue`/`rank`/`equity` from
  `batchGate.ts` — no hand-typed poker numbers were added anywhere in this batch.

## Facts next agent MUST re-check

- If `HAND_AT_RANK`'s underlying dataset ever changes (it shouldn't; it's frozen per
  `FISHTILT_WP_R_STRENGTH_DATASET.md`), all 3 new pinned tests and the pre-existing 4 would
  need re-verification together, since they all read the same live dataset via `factValue`.
- `tests/e2e/hands.spec.ts` "emits FAQPage…" for `aks/ako/aqs/aqo/ajs` should be re-confirmed
  once the shared e2e suite runs again (not run individually here — build-lock was held only
  for the build + screenshots, per the "hold the lock as briefly as possible" rule).
