# WP-G4 — The Registry Skeleton

Registry-only work package. No article prose was authored; every record added is `PLANNED`
with id, slug, title, description and relations only, so the ten downstream content agents
(H1 H2 H3 · I1 I2 I3 I4 · J1 J2 · E3) can each write their own MDX and flip their own
records to `PUBLISHED` in parallel, with `content.test.ts`/`graph.test.ts` already green
against the full graph.

## 1. Scope

- Registered every record in `docs/FISHTILT_CONTENT_PLAN.md` not already on disk: 17 blog
  articles, 48 glossary terms, 18 hand pages.
- Filled in missing `prerequisites` / `relatedConcepts` / `relatedTools` / `relatedArticles`
  / `nextLessons` on the 14 already-registered lessons (per plan §1.2), so every relation the
  plan names actually resolves once the corresponding new record exists.
- Verified `hand-rankings`'s `slug` is `poker-hand-rankings` (WP-G2 already did this — no
  further change needed).
- Did not touch: any MDX file, `src/content/{learn,blog,glossary,hands}/*.ts` (MDX maps),
  `facts.ts`, `allowList.ts`, `src/app/**`, `src/components/**`, `src/features/**`,
  `src/lib/routes.ts`, lesson 06 (`poker-range`, already `PUBLISHED` — untouched per its own
  instruction), lesson 09's `title`/`description` (explicitly H2's authoring fix, not
  registry infrastructure — see §6).

## 2. Files changed

| File | What |
| --- | --- |
| `apps/fishtilt/src/content/registry/learn/h1.ts` | Added missing relations to lessons 01, 02, 04, 05 |
| `apps/fishtilt/src/content/registry/learn/h2.ts` | Added missing relations to lessons 07, 08, 09, 10 |
| `apps/fishtilt/src/content/registry/learn/h3.ts` | Added missing relations to lessons 11-15 |
| `apps/fishtilt/src/content/registry/blog/i1.ts` | +4 `PLANNED` records |
| `apps/fishtilt/src/content/registry/blog/i2.ts` | +5 `PLANNED` records (file was empty) |
| `apps/fishtilt/src/content/registry/blog/i3.ts` | +4 `PLANNED` records |
| `apps/fishtilt/src/content/registry/blog/i4.ts` | +4 `PLANNED` records |
| `apps/fishtilt/src/content/registry/glossary/j1.ts` | +26 `PLANNED` records |
| `apps/fishtilt/src/content/registry/glossary/j2.ts` | +22 `PLANNED` records |
| `apps/fishtilt/src/content/registry/hands/e3.ts` | +18 `PLANNED` records |
| `docs/reports/WP_G4_REGISTRY_SKELETON.md` | this report |

No barrel (`registry/*/index.ts`, `registry/index.ts`) needed a change — every batch array
was already wired in by WP-G2.

## 3. Record counts per kind

| Kind | Existing (pre-WP-G4) | Added | Total | Verified |
| --- | --- | --- | --- | --- |
| learn | 15 | 0 (relations only) | 15 | `LEARN_RECORDS.length === 15` |
| blog | 3 | 17 | 20 | `BLOG_RECORDS.length === 20` |
| glossary | 8 | 48 | 56 | `GLOSSARY_RECORDS.length === 56` |
| hands | 2 | 18 | 20 | `HAND_RECORDS.length === 20` |
| **Total** | **28** | **83** | **111** | `ALL_CONTENT.length === 111` |

`status: 'PUBLISHED'` count is unchanged at 4 (`poker-range`, `blog-aks-vs-ako`,
`term-range`, `hand-aks`) — this WP registered structure only, it did not publish anything.
107 records are `PLANNED`.

## 4. Alias-collision resolutions

None required beyond what the content plan had already resolved (ruling 13: BB/Big Blind,
BTN/Button, Out/Outs merged; SB renamed Small Blind). Every alias in §3.3/§3.4 was used
verbatim from the plan's tables — no new merge was needed because the plan's own 56-term
list was already collision-free. Verified two ways:

1. `graph.test.ts`'s `glossary` describe block (`aliases are unique across the whole
   glossary`, `an alias never collides with another entry's term or slug`) — both pass
   against the full 56-term registry.
2. Manual scan while drafting: confirmed no alias string is duplicated within one entry's own
   array (the uniqueness test also catches an internal duplicate, since `seen.get(alias)` is
   already set by the first occurrence) and no alias equals another entry's `term`/`slug`.

## 5. `indexPolicy` decision and rationale

Every record this WP added or touched is `status: 'PLANNED'`, and `content.test.ts` /
`threshold.ts` forbid `indexable: true` on anything but a `PUBLISHED` record with measured
MDX clearing its kind's floor. Since no MDX exists yet for any of these 83 new records, the
decision is mechanical, not editorial: **`indexable: false`, `readMinutes: null` on every
one.** WP-G2's flagged "hands-page indexability tension" (template-computed sections 3/5/6
not counting toward `threshold.ts`'s measurement) is a real concern for whoever authors the
hand pages' MDX and flips them to `PUBLISHED` — it does not apply to a `PLANNED` record and
is not re-litigated here; flagged again below for E3.

## 6. Plan vs. schema tensions

- **Glossary §3.4 is short two of the nine 5-card hand-category names.** Ruling 13 states
  the 12 terms added beyond §23's 45 include "the nine category names", but §3.4's table
  (rows 36-44) only lists seven: High Card, Two Pair, Three of a Kind, Straight, Flush, Full
  House, Straight Flush, plus the umbrella `Hand Ranking` and non-category terms Kicker/Split
  Pot/Nuts. **`One Pair` and `Four of a Kind` (Quads) have no glossary entry.** My task's own
  boundary was explicit ("8 exist, add 48 to reach 56" — a fixed total), and §3.4 fixes ids
  the same way §2.2 does ("do not invent alternatives"), so I registered exactly the 56 the
  plan names rather than adding a 57th/58th to close this gap myself. Reported per CLAUDE.md
  rule 9 ("if you disagree, report it — do not relitigate it in code") rather than resolved.
  `CATEGORY_RANK`/`CATEGORY_FREQUENCY` facts still work for `PAIR`/`FOUR_OF_A_KIND` args
  without a glossary entry to back them (a `<Fact>` needs no `<Term>`), so no article is
  blocked by this — only a `<Term id="term-pair">`/`<Term id="term-four-of-a-kind">` popover
  would be, and nothing in the plan calls for one.
- **`routes.ts` changed under me mid-task.** `toolStartingHand` was `available: false` when
  I started (WP-E2 was "landing now" per my brief) and flipped to `true` partway through —
  confirmed by re-reading the file before finishing. I used `toolStartingHand`/`toolEquity`
  directly (both now shipped) wherever the content plan named them as the eventual
  replacement for a `range`/`toolOuts` fallback (e.g. blog #1-3, #5, and all 18 new hand
  pages' `relatedTools`), rather than the plan's now-stale fallback instruction. This matches
  the existing WP-G2-authored pattern (`h1.ts` already listed `toolStartingHand` in
  `relatedTools` while it was still unavailable) — `relatedTools` never requires
  `available: true`; `linkOfTool`/`ToolCTA` degrade a `PLANNED`-tool reference to
  non-interactive text, which is exactly the honesty gate the rest of the site already uses.
  `practice` and `search` remain `available: false` and are not referenced by any new record.
- **Lesson 09's title/description bug (ruling 12 / plan §1.1 R3) is left untouched.** The
  content plan explicitly assigns this fix to H2 ("Registry amendment you own"), and my brief
  listed only `prerequisites` / `relatedTools` / `relatedConcepts` / `relatedArticles` /
  `nextLessons` as the fields to complete for the 15 existing lessons — not `title` or
  `description`. Flagging here so H2 does not assume WP-G4 already handled it.
- **WP-G2's hands-page indexability tension stands, unresolved by design.** `threshold.ts`
  only measures the MDX file; a hand page's template-computed sections (3/5/6) will not
  count toward its floor. Not a registry concern — flagged again for E3, which is who
  actually writes the MDX and decides `indexable`.

## 7. Tests run (real counts)

| Gate | Result |
| --- | --- |
| `pnpm vitest run --project fishtilt src/content/content.test.ts src/content/graph.test.ts` | **52/52 passed** |
| `pnpm vitest run --project fishtilt` (whole app) | **667/667 passed**, 65 test files (baseline before this WP: 596 per WP-G2's report, some of the delta from a concurrent E2 agent's own test additions) |
| `pnpm --filter @gto-self/fishtilt typecheck` | clean |
| `pnpm typecheck` (all 13 workspace projects) | clean |
| `npx eslint apps/fishtilt --max-warnings=0` | clean, zero warnings |

`pnpm build:fishtilt` / `pnpm e2e:fishtilt` intentionally **not run** — out of this WP's
scope per the brief (orchestrator's gate).

## 8. Known limitations

- No MDX was authored anywhere; `readMinutes` is `null` and `indexable: false` on all 83 new
  records by construction (see §5).
- `relatedConcepts`/`relatedArticles`/`relatedHands` added beyond what plan §1.2's table
  literally names, in two places, to satisfy §5's "no orphan" rule (not machine-enforced by
  `content.test.ts`, but stated as a hard rule in the plan):
  - Six blog articles have no inbound `relatedArticles` edge from any lesson in §1.2's table
    (`blog-how-often-aa`, `blog-small-pocket-pairs`, `blog-why-72o-is-weak`,
    `blog-why-suited-matters`, `blog-what-is-kicker`, `blog-a2345-wheel`). Each was given one
    inbound edge from the first lesson named in its own "Defers to" column (§2.2) —
    `hand-matrix`, `starting-hands` (×2), `starting-hand-ranking`, `hand-rankings` (×2)
    respectively.
  - All 18 new hand pages needed an inbound edge from a lesson's `relatedHands` (none existed
    before this WP). Split by shape rather than dumped onto one lesson: the 9 pocket-pair
    pages (`hand-aa` … `hand-22`) went to lesson 04 (`starting-hand-ranking`, the ranking
    lesson); the 9 suited/offsuit pages (`hand-aqs` … `hand-a5s`) went to lesson 05
    (`hand-matrix`, the grid lesson). Both lessons already carried `hand-aks`/`hand-ako`, so
    this is additive to an existing, plan-sanctioned pattern, not a new one.
- Each new hand page's own `relatedHands` links to 1-2 thematically adjacent hands (adjacent
  pair rank, or a same-high-card suited/offsuit pair) — a judgment call, not specified by the
  plan, made to satisfy the ≥1 floor with a defensible choice rather than an arbitrary one.
- `blog-qq-vs-ak` (#5) was written per `docs/FISHTILT_STATE.md` ruling 24, citing
  `CLASS_VS_CLASS_EQUITY` rather than fixing four concrete cards — the content plan's own
  §2.4/§4 text is stale on this point (superseded before the fact existed); this WP's
  registry record and description reflect the correction, not the stale plan text.

## 9. Per-batch record manifest

Verbatim — paste directly into each batch's prompt.

**H1** (`registry/learn/h1.ts`): `holdem-basics`, `hand-rankings`, `starting-hands`,
`starting-hand-ranking`, `hand-matrix`

**H2** (`registry/learn/h2.ts`): `position`, `positions-6max`, `poker-actions`, `preflop`

**H3** (`registry/learn/h3.ts`): `flop-turn-river`, `three-bet`, `equity`, `pot-odds`, `outs`

**I1** (`registry/blog/i1.ts`): `blog-aks-vs-ako`, `blog-next-best-after-aa`,
`blog-how-often-aa`, `blog-is-ak-good`, `blog-qq-vs-ak`

**I2** (`registry/blog/i2.ts`): `blog-small-pocket-pairs`, `blog-why-72o-is-weak`,
`blog-why-suited-matters`, `blog-flush-vs-straight`, `blog-full-house-vs-flush`

**I3** (`registry/blog/i3.ts`): `blog-btn-why-wide`, `blog-same-pair-who-wins`,
`blog-what-is-kicker`, `blog-playing-the-board`, `blog-a2345-wheel`

**I4** (`registry/blog/i4.ts`): `blog-outs-nine`, `blog-why-blinds-exist`,
`blog-why-called-3bet`, `blog-why-use-range`, `blog-pot-odds-quick`

**J1** (`registry/glossary/j1.ts`, 28): `term-position`, `term-open-raise`, `term-action`,
`term-all-in`, `term-ante`, `term-blind`, `term-big-blind`, `term-small-blind`,
`term-button`, `term-cutoff`, `term-hijack`, `term-utg`, `term-stack`, `term-pot`,
`term-check`, `term-call`, `term-bet`, `term-raise`, `term-fold`, `term-limp`,
`term-three-bet`, `term-four-bet`, `term-c-bet`, `term-bluff`, `term-heads-up`,
`term-showdown`, `term-vpip`, `term-pfr`

**J2** (`registry/glossary/j2.ts`, 28): `term-range`, `term-suited`, `term-offsuit`,
`term-pocket-pair`, `term-combo`, `term-preflop`, `term-hand`, `term-board`,
`term-community-cards`, `term-flop`, `term-turn`, `term-river`, `term-hand-ranking`,
`term-high-card`, `term-two-pair`, `term-three-of-a-kind`, `term-straight`, `term-flush`,
`term-full-house`, `term-straight-flush`, `term-kicker`, `term-split-pot`,
`term-hand-matrix`, `term-draw`, `term-outs`, `term-equity`, `term-pot-odds`, `term-nuts`

**E3** (`registry/hands/e3.ts`, 20): `hand-aks`, `hand-ako`, `hand-aa`, `hand-kk`, `hand-qq`,
`hand-jj`, `hand-tt`, `hand-99`, `hand-88`, `hand-77`, `hand-22`, `hand-aqs`, `hand-aqo`,
`hand-ajs`, `hand-kqs`, `hand-kjs`, `hand-qjs`, `hand-jts`, `hand-t9s`, `hand-a5s`
