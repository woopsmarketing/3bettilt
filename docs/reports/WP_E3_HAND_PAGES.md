# WP-E3 — The 20 Priority Hand Pages

## 1. Scope

Twenty `/hands/[hand]` pages, `docs/FISHTILT_CONTENT_PLAN.md` §4's priority list: `hand-aks`,
`hand-ako`, `hand-aa`, `hand-kk`, `hand-qq`, `hand-jj`, `hand-tt`, `hand-99`, `hand-88`,
`hand-77`, `hand-22`, `hand-aqs`, `hand-aqo`, `hand-ajs`, `hand-kqs`, `hand-kjs`, `hand-qjs`,
`hand-jts`, `hand-t9s`, `hand-a5s`. `hand-aks` had a one-sentence WP-G2 placeholder MDX file
(the `/hands` route's proof record); the other nineteen had a `PLANNED` registry record and
no MDX at all. All twenty registry records are now `PLANNED` → `PUBLISHED`, all twenty MDX
files are real articles, and this is the complete `hands` registry (`registry/hands/index.ts`
re-exports this batch's records as the whole kind) — nothing in this batch is a subset.

Work proceeded one hand at a time (write MDX → measure → register → flip status) so the repo
stayed consistent at every point — no orphan MDX, no `PUBLISHED` record without a page.

Mid-task, the coordinator raised four rounds of findings, all addressed before this report
was written (detail in §6):

1. Two `content.test.ts` failures (`<Term>` used without a matching `relatedConcepts` entry).
2. A poker-accuracy sweep request (re-read every `<PokerCards>` against its describing prose).
3. A wrong causal claim on `aa.mdx` (the AA↔KK equity gap misattributed to a single rare
   confrontation instead of the real, recurring mechanism), plus a request to check every
   other page for the same reasoning pattern.
4. A wrong generalisation on `ako.mdx` ("AKo ranks below every pair" — false for five of the
   thirteen pairs) and two false "유일하게" (unique) claims on `ako.mdx` and `ajs.mdx`, plus a
   request to re-check every absolute claim (유일/항상/전부/모든) against the real rank table.

## 2. Files changed

| File | What |
| --- | --- |
| `apps/fishtilt/content/hands/aks.mdx` | Rewritten (was a 54-char WP-G2 placeholder) |
| `apps/fishtilt/content/hands/ako.mdx` | New article |
| `apps/fishtilt/content/hands/aa.mdx` | New article |
| `apps/fishtilt/content/hands/kk.mdx` | New article |
| `apps/fishtilt/content/hands/qq.mdx` | New article |
| `apps/fishtilt/content/hands/jj.mdx` | New article |
| `apps/fishtilt/content/hands/tt.mdx` | New article |
| `apps/fishtilt/content/hands/99.mdx` | New article |
| `apps/fishtilt/content/hands/88.mdx` | New article |
| `apps/fishtilt/content/hands/77.mdx` | New article |
| `apps/fishtilt/content/hands/22.mdx` | New article |
| `apps/fishtilt/content/hands/aqs.mdx` | New article |
| `apps/fishtilt/content/hands/aqo.mdx` | New article |
| `apps/fishtilt/content/hands/ajs.mdx` | New article |
| `apps/fishtilt/content/hands/kqs.mdx` | New article |
| `apps/fishtilt/content/hands/kjs.mdx` | New article |
| `apps/fishtilt/content/hands/qjs.mdx` | New article |
| `apps/fishtilt/content/hands/jts.mdx` | New article |
| `apps/fishtilt/content/hands/t9s.mdx` | New article |
| `apps/fishtilt/content/hands/a5s.mdx` | New article |
| `apps/fishtilt/src/content/hands/e3.ts` | MDX map — 20 imports/entries (was 0) |
| `apps/fishtilt/src/content/registry/hands/e3.ts` | 20 records flipped `PLANNED` → `PUBLISHED`, `indexable: true`, `readMinutes` set from measured prose; `relatedConcepts`/`relatedHands` extended where prose cross-references a term or hand the original skeleton didn't list; one pre-existing title typo fixed (`t9s`: "10와" → "10과") |
| `apps/fishtilt/src/content/registry/hands/e3.test.ts` | New batch test file (31 tests) |
| `docs/reports/WP_E3_HAND_PAGES.md` | This report |

Nothing outside this list was touched. `content.test.ts`, `tests/e2e/hands.spec.ts`,
`src/app/hands/page.test.tsx`, `graph.ts`, `types.ts`, `allowList.ts`, `facts.ts`, `routes.ts`
were read but never edited, per the file boundary and the coordinator's explicit instruction
not to touch the e2e/app-test sweep.

## 3. All 20 pages

Ranks and equities below are `HAND_RANK`/`HAND_EQUITY_VS_RANDOM` values pulled live through
`factValue()` in a scratch script — not reasoned about — matching what each page's own
`<Fact>` tags render.

| id | rank | the one differentiating thing | prose chars | indexable |
| --- | ---: | --- | ---: | --- |
| `hand-aa` | 1 | Sole rank-1 hand; the AA↔KK equity gap is explained by ace scarcity (AA holds both aces, so no ace can ever appear against it), not a single rare AA-vs-KK confrontation | 867 | yes |
| `hand-kk` | 2 | The KK→QQ equity gap is *smaller* than the AA→KK gap, though QQ has two higher ranks above it (A, K) to KK's one — a genuinely counterintuitive, evaluator-checked reversal | 740 | yes |
| `hand-qq` | 3 | QQ is actually favored in *both* frozen `CLASS_VS_CLASS_EQUITY` matchups against AKs and AKo (53.95%, 56.76%) — corrects the "QQ folds to AK" folk belief | 681 | yes |
| `hand-jj` | 4 | JJ (rank 4) outranks AKs (rank 8), the best non-pair hand in the whole table | 621 | yes |
| `hand-tt` | 5 | Only two-digit-numbered pocket pair; explains the T-for-10 notation; 5th of the top-7 all-pair block (one past the true midpoint, JJ) | 613 | yes |
| `hand-99` | 6 | Second-to-last of the top-7 all-pair block, right before AKs breaks the streak at rank 8 | 628 | yes |
| `hand-88` | 7 | Last of the top-7 all-pair block; the exact boundary where non-pair hands start interleaving | 609 | yes |
| `hand-77` | 9 | The first pair *after* AKs interrupts the all-pair streak — the reciprocal of 88's page | 613 | yes |
| `hand-22` | 87 | Weakest pair, top-share ≈ median (48.11%) — but its RFI range membership is narrow (SB only), not empty, correcting ruling 48 | 605 | yes |
| `hand-aks` | 8 | Highest-ranked non-pair hand; first non-pair slot in the whole 169-hand table | 773 | yes |
| `hand-ako` | 12 | Highest-ranked *offsuit* hand of all 169; sits below pairs AA–77 but *above* 66–22 (not "below every pair") | 828 | yes |
| `hand-aqs` | 10 | Second-best ace-suited hand; only one hand (77, a pair) sits between it and AKs | 609 | yes |
| `hand-aqo` | 14 | Outranks KQs despite being offsuit — an ace outweighs suitedness here | 649 | yes |
| `hand-ajs` | 11 | Outranks AKo (rank 12) despite s/o notation suggesting AKo should be stronger | 659 | yes |
| `hand-kqs` | 16 | First hand in the entire 169-table that is neither a pocket pair nor contains an ace | 606 | yes |
| `hand-kjs` | 20 | One-gap broadway hand; corrected the site's own "broadway" definition (was wrongly "face cards only", excluding T) to the standard T–A, five-card definition | 652 | yes |
| `hand-qjs` | 28 | Fully-connected broadway hand (no gap), contrasted directly against KJs's one-gap version | 618 | yes |
| `hand-jts` | 45 | Last hand in the site's connected-suited chain (KQs–QJs–JTs–T9s) where both cards are still broadway cards | 703 | yes |
| `hand-t9s` | 64 | Lowest-ranked suited hand of the 20; breaks the broadway streak (9 is not a broadway card); second-weakest of all 20 site hands (only 22 ranks lower) | 632 | yes |
| `hand-a5s` | 30 | "Wheel ace" with a 3-card gap to its kicker — ranks and plays *below* KQs despite holding an ace, the counter-example to `hand-aqo`'s "ace beats suitedness" page; RFI range membership is *all five* positions, the most surprising ruling-48 correction | 655 | yes |

Prose length range: 605–867 characters (minimum gate is 600). All 20 clear
`unmetIndexRequirements` with margin; none is exactly at the threshold.

20/20 `PUBLISHED`, 20/20 `indexable: true`, 20/20 `readMinutes` matches
`estimateReadMinutes()` of its own measured prose (verified by `content.test.ts` and by this
batch's own `e3.test.ts`).

## 4. The RFI dataset — which of the 20 hands it does not contain, and exact wording

**None.** All 20 hands appear in at least one RFI position. `docs/FISHTILT_STATE.md` ruling
48, as briefed to this agent, assumed both `hand-22` and `hand-a5s` "appear in the 학습용
기본 레인지 for no position at all" — checked against the real evaluator
(`factValue('RFI_POSITIONS_WITH', ...)`), that assumption is wrong for both:

| hand | `RFI_POSITIONS_WITH` (live) |
| --- | --- |
| `22` | `SB` (one position, not zero) |
| `A5s` | `UTG · HJ · CO · BTN · SB` (all five positions — fully included, not excluded) |
| all other 18 | `UTG · HJ · CO · BTN · SB` (all five) |

The facade *can* return the empty-set sentinel (`'한 자리도 없습니다'`) — WP-I2's report
confirms `72o` hits it — but none of this batch's 20 hands do.

Wording used on the two pages this affects:

- `hand-22`'s FAQ section states plainly that 22 is *not* completely absent from the range,
  only narrower than the other pairs ("22는 이 학습용 기본 레인지에서 완전히 빠져 있는 패가
  아닙니다... AA부터 88까지는 이 사이트가 다루는 모든 자리에서 첫 레이즈로 쓰이지만, 22는
  그중 일부에서만 그렇습니다").
- `hand-a5s`'s FAQ section states the stronger, more surprising fact directly: A5s has *no*
  excluded position at all, unlike 22 ("A5s는 순위가 낮은 편이지만, 이 학습용 기본 레인지에서
  첫 레이즈로 쓰이지 않는 자리가 없습니다. 22처럼 순위가 낮으면서 일부 자리에서만 쓰이는
  페어와는 다른 경우입니다").

The exact rendered position list itself (`UTG · HJ · CO · BTN · SB` / `SB`) is produced by
the shared TSX template's own section 6, from the same `RFI_POSITIONS_WITH` fact — not
typed by this agent.

## 5. How 20 pages stayed distinct

A repeatable, evaluator-verified toolkit rather than 20 improvised angles:

- **"N ranks higher" ladder** — AA has 0 card-ranks above it, KK 1 (A), QQ 2 (A, K), JJ 3,
  TT 4, 99 5, 88 6, 77 7, ... 22 12 — used per-page as a qualitative device, always
  Fact-cited, never as an exact linear predictor of equity-gap size; `kk.mdx`'s page
  explicitly demonstrates the ladder is *not* linear (the KK→QQ gap is smaller than the
  AA→KK gap, despite QQ having more higher ranks above it than KK does).
- **`HAND_AT_RANK`** to name a neighbour dynamically (`88.mdx`/`77.mdx`/`aqs.mdx`) instead of
  hard-coding a hand name next to a hard-coded rank number.
- **Cross-category rank surprises**, each independently evaluator-checked: JJ > AKs, AKs >
  77, AQo > KQs, AJs > AKo, KQs = first non-ace/non-pair hand, A5s < KQs.
- **The frozen `CLASS_VS_CLASS_EQUITY` matchups** (`QQ|AKs`, `QQ|AKo`) as `qq.mdx`'s
  flagship device — the only two class-vs-class pairings this dataset can ever answer.
- **Gap-vs-connected framing** for the KQs/KJs/QJs/JTs/T9s broadway ladder, corrected
  mid-batch (§6.3) from an overclaimed "gap has zero effect on equity" to the
  evaluator-checked "gap has a real but small effect, dominated by raw card rank".
- **Cross-referencing a sibling page's own Facts** (e.g. citing AKs's combo count on the AKo
  page, citing AQo's finding on the A5s page) instead of restating a page's own
  already-template-rendered numbers.

## 6. Mid-task findings and fixes (chronological)

### 6.1 `content.test.ts` — missing `relatedConcepts` declarations

`hand-aks` used `<Term id="term-offsuit">` and `hand-ako` used `<Term id="term-suited">` in
cross-referencing prose without declaring the id in that record's `relatedConcepts`. Fixed by
adding the missing ids in `registry/hands/e3.ts` (prose was correct; the declaration was
missing). Re-ran `content.test.ts` → 37/37 green, confirmed before continuing.

### 6.2 `<PokerCards>` audit (poker-accuracy sweep)

Across all 20 final files, `<PokerCards>` is used **exactly once** — `aa.mdx`:
`<PokerCards hand="KK" size="sm" />`, inside the "## KK와 무엇이 갈라놓나요" section, which is
about KK. It uses the `hand=` prop (resolved deterministically from `handClassFacts`), never
the manually-typed `cards=` prop that caused the glossary bug the coordinator described, so it
cannot produce a suit/rank mismatch. Confirmed correctly placed against its describing prose.

### 6.3 Wrong causal reasoning (three rounds)

**Round 1 — `aa.mdx`.** Original text attributed the entire AA↔KK equity gap to "the one case
where K meets A and loses." The real mechanism (confirmed against
`HAND_EQUITY_VS_RANDOM`: AA 85.20%, KK 82.40%, gap 2.80 points; a direct AA-vs-KK
confrontation happens on ~0.49% of deals and swings only ~0.31 points, ~11% of the gap) is
that AA holds both remaining aces, so no ace can ever appear against it, while KK faces all
four live aces appearing in an opponent's hand or on the board — a common, recurring event.
Rewrote `aa.mdx` to state this mechanism; applied the same fix preventatively to an ambiguous
sentence on `kk.mdx` that could be misread the same way.

**Round 2 (self-caught while fixing round 1) — `kk.mdx`'s QQ section.** Claimed "the QQ↔KK
gap is *bigger* than the AA↔KK gap" reasoning from "Q has two higher ranks (A, K) vs K's one."
Checked against real numbers: AA→KK = 2.80 points, KK→QQ = 2.47 points — the *opposite*
direction. Rewrote the section to state the true, smaller gap and use it as an explicit
"intuition says bigger, the number says smaller" teaching point.

**Round 3 (coordinator finding) — `ako.mdx`.** Claimed "AKo ranks below the pairs" as a rule
("최고 숫자 두 장을 나눠 가진 패는, 그 숫자 하나를 통째로 가진 페어를 아직 넘어서지 못합니다").
False: AKo (rank 12) outranks five of the thirteen pairs (66, 55, 44, 33, 22). Rewrote to
state the true, bounded claim — AKo sits below 77 (rank 9) but above 66 (rank 17), in both
rank and equity — and added the genuinely interesting fact the coordinator flagged: AKs
(rank 8) already outranks 77 (rank 9), so the suited version beats a pair on this table.

**Additional self-driven finding during the round-3 sweep — `qjs.mdx`/`kjs.mdx`.** Both pages
originally claimed connectivity ("숫자가 이어져 있는지") has *zero* effect on equity vs
random. Checked directly: comparing same-rank-sum suited hands with different gaps (e.g.
T9s 54.03% vs J8s 54.02%; 87s 47.94% vs 96s 47.43%) shows a real, small, positive effect from
being connected — not zero. Softened both pages from "no effect" to "a real but small effect,
dominated by raw card rank."

### 6.4 False "유일하게" (uniqueness) claims (coordinator finding)

Extracted every sentence combining an absolute word (유일/항상/무조건/전부/모든/맨 위/완전히)
with a hand or rank reference across all 20 files and checked each against `HAND_RANK`/
`HAND_AT_RANK`, per the coordinator's method note.

- **`ako.mdx`**: "AKo is the *only* offsuit hand sandwiched between two suited hands" — false;
  a full 169-rank scan found 18 such sandwiched offsuit hands (ATo at rank 19 is the very
  next one). Dropped the uniqueness claim, kept the true, narrower observation (AKo's own two
  immediate neighbours, AJs and ATs, are both suited) and said plainly that this pattern is
  not unique to AKo.
- **`ajs.mdx`**: "uniquely among this site's hands, a suited hand sits directly above an
  offsuit hand" — true only under a scope ("this site's 20 hands") the sentence's own wording
  ("순위표에서") did not signal; a reader would check it against the full table, where it is
  false (ATs→AQo, A9s→ATo are the same pattern). Cut the uniqueness claim entirely and kept
  the genuinely surprising, still-true point: AJs (11) outranks AKo (12).
- Sixteen other 유일/항상/전부/모든/맨 위 claims were checked and are correct as written,
  including `77.mdx`'s "the top eight contains exactly one non-pair", `aqs.mdx`'s "only 77
  sits between AKs and AQs", and `kqs.mdx`'s "the fifteen ranks above it are all pairs or
  ace-hands" (all re-verified in this pass, not just carried over).
- The two new pages written after this finding (`jts.mdx`, `t9s.mdx`) use the same device
  (`"이 사이트에서 가장 낮은 순위"`, `"22 하나뿐"`) but scope it explicitly to "이 사이트가
  다루는 시작 패" throughout, and both scoped claims were verified true before being written,
  not after.

### 6.5 Literal numbers that should have been `<Fact>`s

Found and fixed, across the sweep: `169가지`/`1326가지` typed directly in eleven files
(replaced with `<Fact name="HAND_CLASS_COUNT" />`/`<Fact name="COMBO_COUNT" />`); several bare
rank ordinals (`1위`, `8위`, `9위`, `13위`, `15위`, `20위`) typed as plain text alongside an
adjacent `<Fact name="HAND_AT_RANK">` call instead of being replaced by the Fact's own
rendered value; one un-fact-able site-scope count ("이 사이트가 다루는 20가지 시작 패") on
`ajs.mdx` and `t9s.mdx`, removed rather than backed, since no `Fact` computes "how many hand
pages this site has" — that is content-plan scope, not a poker-domain number. Left in place:
`50%`/`100%` as universal conceptual ceilings/baselines (not measured, dataset-sourced
values), matching the one existing precedent for that judgment call.

### 6.6 One more self-caught positional error, found while writing this report

`tt.mdx` claimed TT is "딱 중간 지점" (exactly the middle) of the top-7 all-pair block *and*
"정확히 다섯 번째" (exactly the 5th) in the same sentence — but the middle of a 7-element
sequence is the 4th element (JJ), not the 5th. The 유일/항상/전부/모든 sweep in §6.4 did not
catch this because "중간"/"가운데" was not one of the words searched. Fixed `tt.mdx` to state
the true, weaker claim (TT is 5th, one past JJ's true middle) instead. Separately re-checked
every other "중간"/"가운데" occurrence across all 20 files: `jj.mdx`'s "JJ is the exact middle
of that block" is correct (JJ is the 4th of 7); the other four uses of "가운데" mean "among",
not "the middle position", and `22.mdx`'s hedged "정확히 그 중간쯤" (precisely around the
middle-ish) is consistent with 22's actual top-share (48.11%, close to the 50/50 split it
describes). Re-ran `content.test.ts` and `e3.test.ts` after the fix — both green (68/68).

## 7. Facts needed but unavailable

None required a fact this dataset cannot answer. `CLASS_VS_CLASS_EQUITY` is frozen to
`QQ|AKs`/`QQ|AKo` only (`qq.mdx`'s one use of it); no other page needed a class-vs-class
matchup. No page needed `EXACT_EQUITY`, `OUTS_PROB`, or `POT_ODDS_REQUIRED_EQUITY` — none of
those apply to a starting-hand-class page (they answer concrete-card or draw-street
questions, out of scope here per the content plan).

## 8. Tests run (real counts)

- `npx vitest run --project fishtilt src/content/content.test.ts` → **37 passed** (shared
  suite; final state, after all fixes above).
- `npx vitest run --project fishtilt src/content/registry/hands/e3.test.ts` (new, this batch)
  → **31 passed** — registry structure, MDX-map registration, MDX prose checks (threshold,
  no ESM/h1, allow-listed components only, `<Term>` once-and-declared, `<PokerCards hand=>`
  resolves, every `<Fact>` computes, relation graph resolves, no GTO word, no profitability
  verdict, no bare `169`/`1,326`), plus a dedicated "comparative claims are evaluator-verified"
  block that pins the corrected claims from §6.3/§6.4 (AA>KK, KK→QQ gap < AA→KK gap, AKo
  bounded between 77 and 66, AKo is the best-ranked offsuit hand, AJs>AKo, AKs>77, JJ>AKs,
  KQs is the first non-ace/non-pair hand, AQo>KQs, A5s<KQs, QQ favored vs both AK matchups,
  22's and A5s's exact RFI position sets, T9s is second-to-last of the 20).
- `npx vitest run --project fishtilt` (full app suite) → **112 files / 1233 tests passed**.
- `pnpm typecheck` → clean across all 13 workspace projects (`apps/fishtilt` included).
- `npx eslint apps/fishtilt --max-warnings=0` → clean, no output.

Not run (explicitly out of scope / orchestrator's job): `pnpm build:fishtilt`,
`pnpm e2e:fishtilt`.

## 9. Known limitations

- Prose length is comfortably above the 600-char gate everywhere (605–867), but on the low
  end of that range for several pages (605–620); a future editor tightening any of these
  further should re-run `measureContent` before publishing.
- `HAND_AT_RANK` arguments (e.g. `arg="8"`) are typed literals selecting *which* rank to
  query, verified against the live evaluator at authoring time but not re-derived
  algebraically from a sibling `HAND_RANK` call in the same sentence — if `learn-core`'s
  frozen strength dataset ever changes rank order, these specific argument values (not the
  Facts themselves, which would still compute) could go stale without a build failure. The
  new `e3.test.ts` pins the *outcomes* these arguments depend on (e.g. "rank 8 is the first
  non-pair", "AKo is bounded by 77/66"), so a dataset change that breaks any of these narrative
  devices fails a test rather than shipping silently.
- The corrected "broadway = T·J·Q·K·A" definition now lives only in `kjs.mdx`'s Callout
  prose; there is no `term-broadway` glossary entry, so if a future batch adds one, this
  batch's phrasing should be checked against it for consistency (out of this batch's file
  boundary to add).
- This report and `e3.test.ts` were both written by the same agent that authored the prose;
  per CLAUDE.md §12, a fresh-context independent review of this batch (beyond the
  coordinator's four rounds of targeted findings already applied) has not been done.
