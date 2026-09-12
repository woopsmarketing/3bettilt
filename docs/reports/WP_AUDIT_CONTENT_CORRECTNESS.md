# MASTER content correctness audit — §47 quality gate and §48 language audit

**Date:** 2026-09-05 · **Auditor:** MASTER (orchestrator) · **Scope:** all 111 published content
pieces in `apps/fishtilt/content/` · **Status:** 4 errors fixed, 2 returned to WP-E3

The build spec requires MASTER or a reviewer to *read* content rather than approve it on automated
checks alone (§47), and to scan user-visible text for unexplained jargon (§48). This is that pass.

---

## 1. Headline

| | |
| --- | --- |
| Automated suite at time of audit | **1115 passing, 0 failing** |
| Errors that suite could detect | **0** |
| Errors found by this audit | **6** |
| Invented or unsourced numbers found | **0** |

The two results belong together. **CLAUDE.md rule 2 — never invent numbers — held completely.**
Every real number on the site is computed at build time by `<Fact>`, which throws rather than
falling back. What failed was a different thing: **sentences reasoning about correct numbers.**

---

## 2. Errors found

| # | Page | Error | Status |
| --- | --- | --- | --- |
| 1 | `glossary/draw.mdx`, `glossary/outs.mdx` | Flush-draw illustration showed `Ah Kh 5h Jc 2c` — **three** hearts — while the prose said four and derived 9 outs from it. With three hearts it is not a flush draw at all. | **fixed** → `Ah Kh 5h 2h Jc`, pinned |
| 2 | `glossary/nuts.mdx` | Said one more `7` makes trips; it makes a **pair** (trips needs the pocket pair). And on a page whose subject is the strongest possible hand, it stopped at the flush and never noticed `Jh Th` completes `Th Jh Qh Kh Ah`. | **fixed**, pinned |
| 3 | `hands/aa.mdx` | Attributed the whole AA→KK equity gap to the rare AA-vs-KK confrontation. That explains ~11% of it. | returned to WP-E3 |
| 4 | `hands/ako.mdx` | "AKo는 페어들보다 아래" — AKo is rank 12 and outranks 66, 55, 44, 33, 22. | returned to WP-E3 |
| 5 | `hands/ako.mdx` | "오프수트 패로는 유일하게 수티드 사이에 끼어 있는" — ATo (19) is also sandwiched, between A9s (18) and KJs (20). | returned to WP-E3 |
| 6 | `hands/ajs.mdx` | "유일하게 수티드 패가 오프수트 바로 위" — true only under a scope the sentence does not state; ATs→AQo and A9s→ATo are counterexamples in the table it describes. | returned to WP-E3 |

### The arithmetic behind #3

`HAND_EQUITY_VS_RANDOM`: AA 85.20%, KK 82.40% — a gap of **2.80 points**. A villain holds AA in
6/C(50,2) = **0.49%** of hands, and that matchup swings KK from ~82% to ~18%, contributing
≈ 0.31 points — **about 11%**. The rest comes from what the sentence never mentions: an ace
outranks a king, so *every* ace-containing hand beats KK when an ace hits the board.

The site's own numbers disprove the "one losing matchup" theory: QQ is 79.93%, so KK→QQ is 2.47
points. QQ loses to **two** higher pairs, so on that theory its gap should be roughly double.
It is slightly smaller.

---

## 3. Method — three extraction filters

Reading found errors 1–3 in 13 pages. That does not scale to 111. The remaining errors were found
by extracting **sentence shapes** and checking each hit against the real data.

| Filter | Pattern | Hits | Errors |
| --- | --- | --- | --- |
| **A** | causal connective (때문/이유/그래서) + comparative (더 강/보다/차이) + hand reference | 10 of ~2,000 | 1 |
| **B** | absolute quantifier (유일/항상/무조건/전부/모든) + hand reference | 49 | 2 |
| **C** | a percentage, decimal or thousands-separated number **not** produced by `<Fact>` | 4 | 0 |

Filter C is the clean one, and the most important. All four hits are legitimate: `100%` and `50%`
used as rhetorical bounds, a `90%`/`10%` hypothetical explaining what an equity share means, and
`0 outs → 0%`. **Not one invented statistic in roughly 100 authored pieces.**

Neither filter replaces reading. Errors 1 and 2 had no linguistic tell and were found only by
looking at the page.

---

## 4. Claims verified as correct

Re-derived through `factValue`, not trusted from the page:

| Claim | Computed | Verdict |
| --- | --- | --- |
| `88` vs `AdKd` preflop | 52.29% | "동전 던지기에 가깝지만 완전히 같지는 않다" — right |
| same, flop `As 2h 7c` → turn `3d` | 8.79% → 4.55% | "한 번 더 낮아졌다" — right; 4.55% = 2 outs / 44 |
| `AsKs` vs `AhKh` | 50.00% | "정확히 반반" — exactly, by suit symmetry |
| 9 outs flop→river | 34.97% vs ×4 rule 36.00% | "규칙이 실제보다 높다" — right |
| 4 outs flop→river | 16.47% vs ×4 rule 16.00% | "규칙이 실제보다 낮다" — right |
| flush vs straight frequency | 5,108 vs 10,200 | right |
| full house vs flush | 3,744 vs 5,108 | right |
| every pocket pair's combo count | `C(4,2)` = 6 | right |
| `77.mdx` — one non-pair in the top eight | AKs at 8 | right |
| `aqs.mdx` — only 77 between AKs and AQs | 8, 9, 10 | right |
| `kqs.mdx` — the fifteen above KQs are all pairs or ace-hands | ranks 1–15 | right |

**Every five-card `<PokerCards>` illustration in all 111 files** was run through the real evaluator
and each renders exactly the category its prose claims. Board-and-hole claims in
`what-is-kicker`, `same-pair-who-wins` and `playing-the-board` were re-run through
`evaluateHandRank` — all correct.

The `learn/outs.mdx` result is the one I most expected to find wrong, because it states a real
subtlety in both directions: the ×4 shortcut overshoots at nine outs and undershoots at four.
It gets both right.

---

## 5. §48 beginner-language audit

`EV`, `SPR`, `CBet` appear nowhere. `RFI` appears six times and **never in prose** — only as a URL
parameter inside `<ToolCTA params={{ spot: 'RFI' }}>`. `C-Bet` appears once, glossed in its first
clause.

The real gap was narrower than it first looked and is a **linking** gap, not a content gap: glossary
pages exist for all six positions and for the big blind, but 13 pages used an abbreviation without
ever linking its definition. Fixed by WP-O0 (first occurrence only — linking all twelve `UTG`s on
one page would be worse than the current state).

**Outstanding:** `POSITION_LABEL` maps every position to its bare abbreviation, so `RangeMatrixMini`
and the Range Explorer render `UTG` `HJ` `CO` `BTN` `SB` with no gloss near the control. ADR-0053
keeps the abbreviations and is not reopened; §48 explicitly does not ask for English to be removed.
The missing piece is a one-time explanation beside the control. **Assigned to WP-O2.**

---

## 6. Tests added

Both fixed errors are pinned rather than left to prose review, per ruling 49.

- `registry/glossary/j2.test.ts` — the flush-draw example must show exactly four of one suit, and
  the outs the prose claims must equal 13 minus that count. **Pins the relationship, not the card
  list**, so the example can be rewritten freely.
- Same file — the `nuts` board's five outcomes, asserted through `evaluateHandRank`, *the product's
  own function*, so these are the site's answers rather than a second opinion written into a test.

Both were verified to **fail on the original defect** before being accepted. A regression test that
cannot fail on the bug it was written for is the vacuous-assertion failure mode in a different
costume.

---

## 7. Recommendation for WP-P1

1. **Run filters A and B first, read second.** The class is characterised well enough to hunt
   mechanically; reading is the expensive instrument and should be pointed where filters cannot see.
2. **Check every claim about what a player could make on a shown board by running
   `evaluateHandRank`** — not by reasoning. Errors 1 and 2 both lived there.
3. Treat *"does this page answer the question its own title asks"* as a correctness question.
   `nuts.mdx` defined the term correctly and still failed to identify the nuts.
4. Do not re-audit invented numbers. Filter C is clean and cheap to re-run; spend the budget on
   the reasoning layer instead.
