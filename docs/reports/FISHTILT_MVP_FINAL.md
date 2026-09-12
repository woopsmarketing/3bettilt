# FishTilt MVP — final report

**Date:** 2026-09-06 · **Verdict:** ship-ready, with two owner decisions and one known flaky test
outside this app.

FishTilt is a public, Korean-language, beginner-first Texas Hold'em learning site
(`apps/fishtilt`). It shares the GTO-SELF monorepo and nothing else — no database, no login, no
player data, no affiliate surface. It is not connected to any poker client, and nothing in it
reads, captures, automates or scrapes one.

---

## 1. Final gate — every number below was produced by a command run on the frozen source

| Gate | Command | Result |
| --- | --- | --- |
| Types | `pnpm typecheck` | **clean** — 12 packages + 2 apps |
| Lint (incl. layering rules) | `pnpm lint` | **clean** |
| Unit / integration | `pnpm test` | **4084 passed · 3 skipped · 0 failed** (277 files) |
| FishTilt build | `rm -rf .next && pnpm build:fishtilt` | **135 static pages, 0 errors, 0 unexpected non-200s** |
| FishTilt browser | `pnpm e2e:fishtilt` | **211 passed · 0 failed** |
| Full build | `pnpm build` | **clean** |

The 3 skips are a pre-existing `GTO_SELF_BENCH`-gated benchmark in `apps/web`, unrelated to
FishTilt. The build was run from a **deleted** `.next` — see §7.

Movement across the fix round: e2e 203 → 211, monorepo 4004 → 4087, FishTilt app suite
1336 → 1347.

## 2. What the two independent reviews found

Two fresh-context reviewers were briefed on method and explicitly **not** on the desired verdict
(CLAUDE.md §12).

| Review | Findings | Report |
| --- | --- | --- |
| WP-P1 — poker & mathematics correctness | 3 blocker · 5 should-fix · 5 note | `WP_P1_POKER_CORRECTNESS_REVIEW.md` |
| WP-P2 — beginner UX, IA, SEO | 1 blocker · 14 major · 10 minor | `REVIEW_BEGINNER_UX_SEO.md` |

**All 4 blockers fixed. 38 of 39 findings accepted; 1 rejected with reasoning (§6).** MASTER
verified each blocker in source before accepting it, rather than taking the reports on trust.

The four blockers, because they characterise the whole product risk:

1. `blog/is-ak-good.mdx` claimed AKs and AKo were "both inside the top 10" while the `<Fact>` two
   clauses earlier rendered **12**. The sentence contradicted its own number.
2. `RangeExplorer.tsx` said opening a wider range "does not lose money" — a profitability claim
   with no dataset, contradicting the site's own `blog/btn-why-wide.mdx`. Its stated mechanism
   ("the players before you have probably folded") is also **wrong for the spot on screen**: these
   are RFI ranges, where that probability is 1 at every seat.
3. `glossary/equity.mdx` defined equity as 이길 확률 while rendering a ties-split number. Its own
   `AsKs` vs `AhKh` example was **42.8 pp** off under its own definition (true P(win) 7.16%,
   tie 85.69%), and its stated reason — "the hands are exactly equally strong" — was wrong; the
   50.00% comes from suit symmetry.
4. `glossary/pot-odds.mdx` told the reader to consider calling or folding — the one page a
   beginner reaches when they look the term **up**, contradicting both the tool and the lesson it
   links to.

**Every finding is the same defect class:** a sentence reasoning on top of a correct computed
number. Not one invented number was found in 113 content files — `<Fact>` computes all 20 fact
kinds at build time and throws rather than falling back, and that held completely.

## 3. The structural finding, which outranks any individual fix

Both reviewers converged independently on the same hole: **`src/**` Korean prose had never been
audited.** Every prior sweep — the content audit, the ruling-26 sweep, both filter passes, and the
advice guard in `content.test.ts` — pointed at `content/**`. But roughly half the user-visible
sentences on this site live in `app/**/page.tsx` explanation cards, `features/*/copy.ts` and
`components/*.tsx`, and **six of WP-P1's thirteen findings were there** — including the
profitability claim, a universal kicker rule that is false for straights and full houses, a
shortcut's error direction stated backwards next to a calculator rendering the opposite, and a
provenance sentence asserting the opposite of the truth.

Closed by `apps/fishtilt/src/copy-guards.test.ts`, which reads **both** trees and pins the defect
class rather than the fixed instances:

- **Guard 1** — no sentence may recommend a table action or assert profitability unless it also
  carries a refusal marker. Calibrated to catch F2's and B1's exact original sentences; verified
  by planting them and watching it fail.
- **Guard 2** — one spelling per term site-wide (플랍 · 오프수트 · 베팅 · 수티드 · 거트샷), with
  search aliases exempt because 배팅 and 플롭 are things readers really type.

Guard 2 earned its keep on first run: `content/learn/outs.mdx` still said 것샷 after the tool had
been corrected to 거트샷 — a miss that had fallen between two fix agents' file boundaries.

## 4. Correctness established by running code, not by reading

WP-P1 re-derived rather than reviewed. What it established clean:

- All **9** five-card category frequencies exact and summing to C(52,5) = 2,598,960; frequency
  order is exactly the ranking order, so the site's "rarer is higher" justification is true.
- Suited beats offsuit for **all 78** rank pairs — 0 exceptions, so `why-suited-matters.mdx`'s
  "예외 없이" is literally true.
- **868 generated quiz questions** re-derived against the evaluator and the dataset: 12/12
  hand-ranking, 845/845 range, 11/11 starting-hand. Both genuine ties emit `MIXED` with `TIE`
  offered, so **no correct answer can score wrong**.
- Every board illustration re-evaluated with `bestFiveOf`/`compareHands` (12 cases), including
  both board-plays and both split examples.
- Integer milliBB end to end; float only at the parse boundary.
- **"GTO" appears nowhere user-visible** — only in `@gto-self/*` import specifiers and in ten
  tests asserting its absence.

## 5. Two decisions promoted to ADRs

- **ADR-0082** — the starting-hand metric is an expected pot share with ties split, and may never
  be described as the proportion of the time you win. 승률 is deliberately **not** renamed; the
  definition travels with it. Enforced by tests on three surfaces.
- **ADR-0083** — the range's provenance is a single-source transcription and is described as one,
  behind a single shared constant so the three surfaces cannot drift apart again.

`docs/FISHTILT_STATE.md` carries 106 numbered orchestrator rulings; 94–106 cover this round.

## 6. The one rejected finding

**WP-P2 m2 — refusal boilerplate is copy-pasted across 13 files.** Accurate, and rejected anyway.
Rewording thirteen files' refusal language is the highest-risk, lowest-value edit available, and
the risk is specific: this is the round in which two reviewers found advice *leaking into* content
in four separate places. Those refusals are the mechanism that prevents it. Trading them for prose
variety at the end of the cycle trades the product for a style improvement. Post-MVP follow-up.

## 7. Release requirements — these are blocking, and neither is a code change

1. **Set `NEXT_PUBLIC_SITE_URL` to the real origin before the first production build.** It
   currently falls back to `https://fishtilt.example`, which is deliberate and documented in
   `src/lib/seo/site.ts`, and which would otherwise ship into canonical URLs, `sitemap.xml` and
   Open Graph tags.
2. **Deploy from a clean `.next`.** Ruling 93: an incremental build over an inherited cache once
   prerendered two published lessons as **404s with every test passing**. The build is this
   project's only MDX validator and the last gate before deployment, and it produced a wrong
   artefact from correct source with no failing signal anywhere. `rm -rf .next` before building.

## 8. Open items for the owner

- **Naming the range's source site.** UTG/HJ/CO/BTN are transcribed verbatim from one public
  teaching chart. The page now describes that accurately but does not name the site, because
  naming a specific commercial source in public product copy is an attribution decision that
  belongs to you, not to an agent. The name is in `tables.ts` and `STRATEGY_ANCHORS.md`.
- **Three orphaned glossary entries** — `bluff`, `c-bet`, `nuts` have no inbound links because
  those concepts appear nowhere else in the content. WP-Q1 correctly refused to insert the words
  just to link them. It is a content-coverage gap, not a linking bug.
- **`hands/[hand]/page.tsx` has no colocated unit test**; its section order and equity wording are
  pinned only by e2e.

## 9. Known issues

| Issue | Severity | Detail |
| --- | --- | --- |
| `strategy-core/src/postflop/benchmark.test.ts:249` flakes under full-suite load | low | Compares two wall-clock measurements. Failed once in a full run, then passed twice more and **5/5 in isolation**. Not a FishTilt regression — that package is outside every fix agent's boundary. The real fix is comparing operation counts, not durations; out of scope for this round. |
| Exact per-class win/tie split unavailable | low | The dataset stores only `equity`. WP-P1's gap table used a 30,000-board deterministic sample with the opponent side exhaustive: direction certain, third decimal not. Storing `winBps`/`tieBps` at generation time would close it and let the copy say more. |
| RFI list fidelity to its source is untested | low | Only the percentage bands are checkable in-repo. An independently transcribed fixture (the discipline ADR-0018 applies to rake) would close it. |

## 10. What this round should be remembered for

A green test suite is evidence about the code, not about whether the claims the code makes are
still ones we want to make. Three separate times this round, a **passing** test was pinning a
defect: the synthesis test titled "9-out draw clears the break-even bar" that survived the article
withdrawing exactly that claim; the component test transcribing the note F11 removed for being
false; and the e2e spec doing the same, which would have gone red on correct behaviour. Each was
found by a human-directed question, never by the suite.

The corresponding rule now holds across this app: **a test asserts that a surface renders the
owning module's output, never what that output says.** Wording belongs to the owner's tests, once.
