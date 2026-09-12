# WP-S3-12 G9 — glossary batch 시작 핸드·레인지

## Objective

Own glossary batch g9 (category `starting-hands`): `hand`, `suited`, `offsuit`, `pocket-pair`,
`combo`, `range`, `hand-matrix`. Fix the audit's two flagged items (`hand` WEAK definition,
`hand-matrix` missing example) and add two new terms (`broadway`, `connector`) referenced ad hoc
in hand pages.

## Facts verified before work

- Baseline (`pnpm vitest run --project fishtilt src/content/registry/glossary
  src/content/content.test.ts src/copy-guards.test.ts`): 215/215 passing before any edit.
- All 7 existing g9 MDX files had a lead paragraph restating `shortDefinition` before
  `## 쉽게 설명하면` (or, for `range`, no `## 쉽게 설명하면` heading at all) — the brief's Goal
  section bans this for every term, not just the two audited ones.
- `브로드웨이`/`커넥터`/`갭` are used ad hoc (no link) in `content/hands/kjs.mdx`, `jts.mdx`,
  `qjs.mdx`, `t9s.mdx`, `content/learn/starting-hands.mdx`, `starting-hand-ranking.mdx`, and blog
  `aa-loses.mdx` / `qq-vs-72o-flop-227.mdx`. No file uses "갭" without "커넥터" nearby.
- Valid route ids confirmed in `src/lib/routes.ts`: `toolStartingHand`, `range`, `practice`, etc.
- Valid hand ids confirmed in `src/content/registry/hands/k4.ts`: `hand-kjs`, `hand-qjs`,
  `hand-jts`, `hand-t9s`.
- `term-straight` exists in `g6.ts` (used by `connector.mdx`'s one `<Term>`).
- Glossary threshold (`src/content/threshold.ts`): 400 prose chars / 2 sections / 1 tool /
  1 concept minimum, `minComponents: 0`.

## Decisions made

- **`connector` is ONE record**, not two, covering both 커넥터 (gap 0) and 갭 (gap 1). Every
  source that uses either word teaches them together as one axis (`content/learn/
  starting-hands.mdx`: "숫자가 얼마나 붙어 있는가... 커넥터... 갭 하나짜리 조합"); no hand page
  or blog post links "갭" without "커넥터" beside it. A second near-duplicate stub for "갭" alone
  would either repeat this record's prose (thin/duplicate) or need invented distinguishing
  content this site has no source for. `aliases: ['커넥터', '갭', 'gapper']`, headword `커넥터`
  (it leads in every source usage).
- `hand`'s `shortDefinition` rewritten from a vague "카드를 말합니다" gloss to name the two
  concrete moments (프리플랍 vs 쇼다운) the audit flagged as WEAK (dual meaning). `relatedTools`
  moved `range` → `toolStartingHand` per the audit's tool-replacement table.
- `hand-matrix` gained a genuine `## 예로 보면` example: the AKs cell (row/column intersection,
  diagonal side, combo count via `<Fact name="HAND_COMBOS" arg="AKs">`) rather than only the
  abstract 169-cell description it had before.
- Removed the repeated-`shortDefinition` lead paragraph from all 7 pre-existing g9 files, folding
  the unique factual content each lead carried (notation rules: `s`/`o` suffix, `AA`/`77` double
  notation) into the `## 쉽게 설명하면` section instead of deleting it. `range.mdx` had no
  `## 쉽게 설명하면` heading at all; renamed its first section to that heading and its
  "표로 보면 이렇습니다" section to `## 예로 보면` (the section already held the only example).
- `broadway`/`connector` cross-link each other (`<Term>` in each's "헷갈리기 쉬운 부분") since
  they are the two other axes `starting-hands.mdx` teaches alongside suited/offsuit/pocket-pair,
  and both `relatedConcepts` arrays declare only the ids actually used inline.

## Files changed

- `apps/fishtilt/src/content/registry/glossary/g9.ts` — `term-hand` shortDefinition + relatedTools;
  appended `term-broadway`, `term-connector` records.
- `apps/fishtilt/src/content/glossary/g9.ts` — added `broadway`/`connector` MDX imports + map keys.
- `apps/fishtilt/content/glossary/hand.mdx`, `suited.mdx`, `offsuit.mdx`, `pocket-pair.mdx`,
  `combo.mdx`, `range.mdx`, `hand-matrix.mdx` — removed lead-paragraph duplication;
  `hand-matrix.mdx` gained the AKs worked example; `range.mdx`/`broadway.mdx`/`connector.mdx`
  prose expanded to clear the 400-char floor (orchestrator note).
- `apps/fishtilt/content/glossary/broadway.mdx`, `connector.mdx` — new.
- `apps/fishtilt/src/content/registry/glossary/categories.ts` — added ONLY
  `TERM_CATEGORY.broadway/connector = 'starting-hands'` and
  `TERM_HEADWORD.broadway = '브로드웨이'` / `connector = '커넥터'`. Re-read the file immediately
  before editing (it had already gained `ip-oop`/`set-vs-trips`/`gutshot`/`open-ended` lines from
  other batch agents); no other line touched.

## Tests run

- `pnpm vitest run --project fishtilt src/content/registry/glossary src/content/content.test.ts
  src/copy-guards.test.ts` → 211/215 passing. The 4 failures are NOT g9: `term-bet`,
  `term-raise`, `term-fold` (g3), `term-three-bet`, `term-vpip` (g4) under the 400-char floor
  (other agents' batches, unstable tree at time of this run), plus `categories.test.ts`'s
  `matches the content audit §4 assignment` (its `AUDIT_ASSIGNMENT` fixture is the ORIGINAL
  58-term audit list and has not been updated by anyone for ANY new term yet — `ip-oop`,
  `set-vs-trips`, `gutshot`, `open-ended` from other batches are in the same boat as my
  `broadway`/`connector`). g9's own `batches.test.ts` describe block: 0 failures.
- `pnpm --filter @gto-self/fishtilt typecheck` → 0 errors.
- `pnpm exec eslint apps/fishtilt/src/content/registry/glossary/g9.ts
  apps/fishtilt/src/content/glossary/g9.ts apps/fishtilt/src/content/registry/glossary/
  categories.ts` → 0.
- Did not run build/e2e/screenshots per task instructions.

## Known limitations

- No `visuals.ts` entry added for `broadway`/`connector` — that file is outside my file
  boundary. Both terms use `<PokerCards>` inline in their MDX instead of a header visual.
- readMinutes for all 9 g9 records stays `2` (verified against `estimateReadMinutes` via the
  batch test's "states the reading time its own text implies" — all pass at 2).

## Open issues

- **`categories.test.ts`'s `AUDIT_ASSIGNMENT.starting-hands`** needs `broadway`, `connector`
  added (and the `total` count bumped) once whoever owns `categories.ts`/its test does the
  cross-batch update for every new term (mine + `ip-oop`, `set-vs-trips`, `gutshot`,
  `open-ended` seen from other agents' concurrent edits). Not fixed here — outside my file
  boundary and the fixture needs one coordinated edit, not N racing ones.
- WP-16 (or whichever agent owns `content/hands/*.mdx`) can now wrap 브로드웨이/커넥터/갭
  mentions in `kjs.mdx`, `jts.mdx`, `qjs.mdx`, `t9s.mdx` with `<Term id="term-broadway">` /
  `<Term id="term-connector">` — those files were intentionally left untouched per the task
  boundary.
- `content/learn/starting-hands.mdx` and `starting-hand-ranking.mdx` also use 커넥터/갭/브로드웨이
  in prose without links — the learn-content owner may want the same `<Term>` treatment.

## Exact facts next agent may rely on

- g9 registry now has 9 records: `hand`, `suited`, `offsuit`, `pocket-pair`, `combo`, `range`,
  `hand-matrix`, `broadway`, `connector`. All PUBLISHED, indexable, readMinutes 2.
- `term-connector`'s `aliases` are `['커넥터', '갭', 'gapper']` — no separate `term-gapper`
  record exists or should be created; a hand page or lesson should link "갭" to `term-connector`
  too, not to a nonexistent id.
- `term-broadway` id is `term-broadway`, slug `broadway`; `term-connector` id is `term-connector`,
  slug `connector`. Both category `starting-hands`, headwords `브로드웨이`/`커넥터`.

## Facts next agent MUST re-check

- Re-read `categories.ts` before any further edit — it is being edited by multiple agents
  concurrently; my two additions are at the end of `TERM_CATEGORY`/`TERM_HEADWORD`.
- Re-run `src/content/registry/glossary/batches.test.ts` and `content.test.ts` once other
  batches' in-flight edits land — the g3/g4 threshold failures and the categories.test.ts
  audit-assignment failure listed above were NOT caused by g9 and may already be fixed by the
  time this is read.
