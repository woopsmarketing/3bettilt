# WP-S3-12 — Glossary content, batches G3 + G4 (betting)

## Objective

Rewrite MDX body + fix relations for the 15 `betting` category glossary terms in g3
(action, check, bet, call, raise, fold, all-in) and g4 (open-raise, limp, three-bet,
four-bet, c-bet, bluff, vpip, pfr). Fix the audit's WEAK `action` definition. Request
inbound links for orphans c-bet/bluff.

## Facts verified before work

- Read `AGENT_COMMON_RULES.md`, `WP_S3_11_HANDOFF.md`, audit §4 rows for these 15 slugs,
  and the existing `g3.ts`/`g4.ts` registry + MDX map + all 15 `.mdx` files before editing.
- All 15 MDX files already existed (J1 family) with multiple `##` sections but no
  `## 쉽게 설명하면` / `## 예로 보면` structure and a lead paragraph outside any heading.
- `batches.test.ts` does not literally require those two heading strings — it only bans a
  top-level `#`, import/export, unregistered `<Term>`/`<PokerCards>`, GTO wording, and
  checks `readMinutes`/thresholds. The two-heading structure is WP-S3-12's own content
  convention, applied per the brief.
- `docs/3BETTILT_STAGE3_STATE.md` line 14 records a prior agent's precedent: reducing a
  term's `relatedTools` to nothing was **not applied** because `batches.test.ts`'s
  `minTools: 1` floor for `glossary` kind requires at least one tool. Followed the same
  precedent here (see Decisions).

## Decisions made

- Restructured all 15 MDX files: first section is now `## 쉽게 설명하면` (absorbs the old
  lead paragraph), second is `## 예로 보면` (a concrete scenario; `bluff` keeps its existing
  `<PokerCards hand="72o" />` under this header — no other g3/g4 term has a visual in
  `visuals.ts`, so no other card component was added). Remaining sections kept, reworded
  only where the intro material moved.
- `action` WEAK fix: `shortDefinition`/`description` in `g3.ts` now explicitly separate
  "차례" (the turn/opportunity) from "액션" (the choice made in it) instead of using them as
  loose synonyms; MDX `## 쉽게 설명하면` states the same distinction up front.
- `relatedTools` changes applied in `g3.ts` per the audit's replacement column:
  `action`→`practice`, `check`→`practice`, `fold`→`practice`, `bet`→`toolPotOdds`,
  `all-in`→`toolPotOdds`. `call` was already `toolPotOdds`; `raise` stays `range`
  (not in the replacement list).
- `c-bet` and `bluff` (`g4.ts`): audit says `range→없음`. Orchestrator decision: `minTools: 1`
  stays, and where no tool is genuinely relevant the honest link is `practice` (quiz hub),
  not an empty list and not the irrelevant `range` tool. Changed both to `['practice']`
  (g1/g2 already used this pattern for `ante`/`blind`).
- Follow-up fix: added a genuine "헷갈리기 쉬운 부분"-style section to 5 terms that fell
  under the 400-character glossary floor once the lead paragraph moved under a heading —
  `bet` (베팅 vs 레이즈 구분), `raise` (레이즈 vs 베팅 구분), `fold` (언제 폴드가 선택지가
  되는지), `three-bet` (세 번째로 세는 순서, worked through), `vpip` (세는 것/세지 않는 것
  나란히 대조). No filler — each adds a distinction a beginner needs, not already stated.
  Caused two duplicate `<Term>` uses and one undeclared relation, fixed by using plain text
  for the second mention (raise/term-bet, three-bet/term-open-raise) and dropping the
  `<Term>` wrapper for vpip's second `레이즈` mention (not in `relatedConcepts`).
- No new terms in this batch (none requested). No changes to `relatedConcepts` /
  `nextLessons` / `relatedArticles` beyond what already existed — all already point at real,
  genuinely related ids and needed no repair.

## Files changed

- `apps/fishtilt/src/content/registry/glossary/g3.ts` — `relatedTools` for
  action/check/fold/bet/all-in; `action.shortDefinition`/`description` rewritten.
- `apps/fishtilt/src/content/registry/glossary/g4.ts` — unchanged (deviation above).
- `apps/fishtilt/src/content/glossary/g3.ts`, `g4.ts` — unchanged (map wiring was already
  correct).
- `apps/fishtilt/content/glossary/{action,check,bet,call,raise,fold,all-in,open-raise,limp,
  three-bet,four-bet,c-bet,bluff,vpip,pfr}.mdx` — restructured (15 files).

## Tests run

- First pass: `pnpm vitest run --project fishtilt src/content/registry/glossary src/content/content.test.ts src/copy-guards.test.ts`
  → 3 files FAIL, none naming a g3/g4 slug at the time — but the coordinator's follow-up
  caught 5 g3/g4 terms that had dropped under the 400-char glossary floor after the lead
  paragraph moved under a heading (`bet` 356, `raise` 381, `fold` 366, `three-bet` 398,
  `vpip` 396). Fixed by adding real content (see Decisions), then also applied the
  c-bet/bluff `relatedTools` → `practice` change.
- After both fixes: `pnpm vitest run --project fishtilt src/content/registry/glossary`
  → `batches.test.ts` (the file that actually gates g3/g4 threshold/readMinutes/Term rules)
  is 119/119 PASS. Whole-registry run is 165 passed / 1 failed; the 1 failure is
  `categories.test.ts`'s `starting-hands` audit-assignment row, caused by another agent's
  g9 additions (`broadway`, `connector` not yet in `AUDIT_ASSIGNMENT`) — outside this
  batch's file boundary, not touched.
- `readMinutes` unaffected: all 5 edited terms stayed at 400–800 measured characters, so
  `estimateReadMinutes` still floors at 2 for every one of them — no `readMinutes` edit
  needed (verified by the passing `states the reading time its own text implies` assertion
  in `batches.test.ts`).
- `pnpm --filter @gto-self/fishtilt typecheck` → 0 errors (re-run after both fixes).
- `pnpm exec eslint` on `g3.ts`/`g4.ts` → 0 errors/warnings (re-run after both fixes).
- Did NOT run build, e2e, or screenshots per brief.

## Known limitations

- MDX prose otherwise unchanged in substance from the pre-existing files — this was a
  structural rewrite (headings) plus the `action` definition fix, the 7 tool-id swaps
  (5 in g3, c-bet/bluff in g4), and the 5 added distinction sections, not a full content
  rewrite of every sentence.

## Open issues (requests for other owners, no edits made)

- **Inbound links requested** for two orphans (audit: inbound 0):
  - `c-bet` ← add a `relatedConcepts`/mention link from `learn/flop-turn-river`.
  - `bluff` ← add a `relatedConcepts`/mention link from `learn/poker-actions`.
  (Per brief: request only, not edited — these files are owned by the learn-content agent.)
- `set-vs-trips.mdx` missing on disk breaks `content.test.ts` and `batches.test.ts`
  collection entirely (both report 0 tests / suite failure) and fails
  `categories.test.ts`'s hand-rankings row — owner of that term (g6/g7, `three-of-a-kind`
  family) needs to add the file.

## Exact facts next agent may rely on

- g3/g4 `relatedTools` final state: action/check/fold → `practice`; bet/all-in →
  `toolPotOdds`; call → `toolPotOdds` (pre-existing); raise/open-raise/limp/three-bet/
  four-bet/c-bet/bluff/vpip/pfr → `range` (unchanged).
- All 15 g3/g4 MDX files now start with `## 쉽게 설명하면` then `## 예로 보면`, no lead
  paragraph outside a heading, no `#`, no import/export.
- `action`'s dual-meaning WEAK note is resolved via `shortDefinition`/`description` wording,
  not via alias changes — aliases `['액션', '행동', '차례']` untouched (still unique
  dictionary-wide, unaffected by this change).

## Facts next agent MUST re-check

- Re-run the fast gate once `set-vs-trips.mdx` exists elsewhere, to get an actual PASS/FAIL
  count for `content.test.ts`/`batches.test.ts` rather than a suite-level ENOENT.
- The orchestrator's single final `pnpm build` is what proves these 15 `.mdx` files compile
  under `@next/mdx` — not checked in this batch per brief instruction.
