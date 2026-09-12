# WP-S3-19 — poker-correctness remediation (review A MAJORs)

## Objective

Fix exactly the top MAJOR ("승률" names two quantities) and the seven one-line MAJORs from
`docs/reports/stage3/review/WP_S3_18_REVIEW_A.md`. Labels/copy/FAQ/prose only — no calculation
changed. Each corrected claim pinned with one engine-computed assertion in an existing test.
BLOCKERs 1-4 (button, ip-oop, full-house-vs-flush, small-pocket-pairs) untouched — orchestrator's.

## Facts verified before work (engine, throwaway vitest, not typed from memory)

| Fact | Value |
| --- | --- |
| AsAh vs KsKh preflop | win 82.36% · tie 0.54% · equity 82.64% (label gap the reviewer saw) |
| AsKs vs AhKh preflop | win 7.16% · tie 85.69% · equity 50.00% (42.8pp gap) |
| 22 | rank 87/169 · equity 50.33% · `cumulativeShare` 48.11% · rank/169 = 51.48% |
| T9s | rank 64/169 · equity 54.03% |
| KQs / KK rank | 16 / 2 |
| rank vs equity inversions over 169 | 0 |
| suited/offsuit RFI seat-count over 78 pairs | 18 equal · 60 split · 0 reversed (AK, AQ, AJ, AT, KQ, KJ, QJ, T2, 93, 92, 83, 82, 73, 72, 62, 52, 42, 32 equal) |
| `handClassByKey('AA')` | row 0 · col 0 (matrix index 0) |
| S2 flop 9d 4c 2s, villain Ad 4d | paired rank 4 = middle of the three flop ranks |

## Item 1 — "승률" as two quantities (top MAJOR)

Site vocabulary after this change: **승률(Equity) = wins + half the ties = expected pot share**
(as `learn/equity.mdx`, `METHODOLOGY_SENTENCE`, hand page §5 already say). Pure win probability is
called **이김 / 이길 확률**, never 승률.

| Surface | Was | Now |
| --- | --- | --- |
| `src/features/tools/equity.ts` `EQUITY_HERO_LABEL` (value = `heroWinBps`, pure win) | `내 핸드 승률` | `내가 이김` |
| same file `EQUITY_VILLAIN_LABEL` (value = `villainWinBps`) | `상대` | `상대가 이김` |
| `src/features/tools/faq.ts` EQUITY_FAQ #1 (also the FAQPage JSON-LD) | "내가 팟을 가져갈 확률" | expected pot share; ties count as half a win; "이길 확률 그 자체와는 다른 숫자"; names the calculator's 내가 이김/비김 rows as the pure parts |
| EQUITY_FAQ #2 | "내 승률, 비기는 확률, 상대 승률 세 가지" | "내가 이기는 확률, 비기는 확률, 상대가 이기는 확률" + "비기는 확률의 절반을 더한 값이 내 승률(Equity)" |
| `src/app/[locale]/hands/page.tsx` hub `<title>` / description | `…조합 수·승률` / "무작위 상대와의 승률" | `…조합 수·기대 몫` / "무작위 상대와 끝까지 갔을 때 팟에서 기대되는 몫" |
| `content/hands/22.mdx:19` | "이긴 횟수의 비율이 대략 절반" | "팟에서 가져갈 것으로 기대되는 몫이 대략 절반 … 이긴 횟수의 비율 그 자체와는 다른 숫자" |

Hand pages (57 × 승률): every remaining use is `HAND_EQUITY_VS_RANDOM`/`CLASS_VS_CLASS_EQUITY`
= pot share, consistent with the definition — left as is (D1 "friendly label"). Only 22.mdx:19
and t9s.mdx:19 were actually wrong. The static table on the equity page (`EquityGuide.tsx:132`,
label 승률, value `equity`) is already the pot-share quantity, so it is now consistent with the
calculator labels without being touched.

## Item 2 — the seven one-line MAJORs

| File | Was | Now | Pin |
| --- | --- | --- | --- |
| `glossary/hand-ranking.mdx:3` | same category → kicker decides | ranking number first (Q pair beats 8 pair); kicker only in 원페어·투페어·트리플·포카드; 스트레이트·플러시·풀하우스 have no kicker (matches `kicker.mdx:15`) | `claims.test.ts` "hand-ranking": 33 + 4-kicker beats 22 + A-kicker via `evaluateHand`, prose regexes |
| `glossary/broadway.mdx:3` | "오른쪽 위" | "AA가 있는 왼쪽 위 … A·K·Q·J·10" | `claims.test.ts` "broadway": AA row/col 0, all 25 T–A classes have row<5 && col<5, prose has no 오른쪽 위 |
| `hands/t9s.mdx:19` | rank = "이 사이트가 다루는 패" relative; "항상 같은 방향은 아니다" | rank = all 169 ordered by pot share, so they always move together; 22 is merely the lowest of the twenty registry hands; T9s in the upper half, 22 near the middle | `k4.test.ts`: 0 inversions across `HAND_STRENGTH_BY_RANK` (169 entries) |
| `hands/kqs.mdx:1` | "A 없는 패 중 가장 먼저" | "포켓 페어도 아니고 A도 없는 패 중 가장 먼저 … KK 같은 포켓 페어가 그보다 위" | already pinned by `k4.test.ts:26` (rank 1..15 are pair-or-ace) |
| `hands/22.mdx:8` | "169가지 중 상위 X%" | "실제로 받게 되는 조합 전체의 상위 X% … 169가지 종류 중 몇 번째인지를 세는 순위와는 다른 기준" | `k2.test.ts`: `cumulativeShare === cumulativeCombos/1326`, differs from rank/169 by >1pp, equity within 5pp of 0.5 |
| `blog/qq-three-bet-frustration.mdx:43,51,57` | 바텀 페어 ×4 (one wrapped across lines 43-44) | 미들 페어 ×4 | `s2.test.ts`: paired flop rank is the median of the three flop ranks; source has 미들, no 바텀 |
| `learn/poker-range.mdx:143` FAQ | "같은 무늬 쪽이 더 여러 자리에서 쓰입니다" | suited never used from fewer seats; some cells split by suit, some (AKs/AKo) identical — now agrees with `starting-hands.mdx:82` | `learn-L2.claims.test.ts`: over 78 pairs suited ⊇ offsuit, equal>0, split>0, AKs==AKo, prose regexes |

## Decisions made

- 승률 stays the site's friendly word for equity (pot share) — the existing D1 disposition. The
  fix removes the one surface that used it for pure win (calculator hero label) and the FAQ
  definition, rather than purging 승률 site-wide.
- Villain label changed to `상대가 이김` for symmetry with `내가 이김` (both rows are pure-win values).
- Hub title says `기대 몫` (reviewer's suggestion); description spells out the pot-share meaning.

## Files changed (17)

Content MDX (7): `apps/fishtilt/content/glossary/hand-ranking.mdx`, `glossary/broadway.mdx`,
`hands/t9s.mdx`, `hands/kqs.mdx`, `hands/22.mdx`, `blog/qq-three-bet-frustration.mdx`,
`learn/poker-range.mdx`.
TS copy (3): `apps/fishtilt/src/features/tools/equity.ts`, `src/features/tools/faq.ts`,
`src/app/[locale]/hands/page.tsx`.
Registry readMinutes (2): `src/content/registry/hands/k2.ts` (22: 2→3), `k4.ts` (t9s: 2→3) —
values the test reported after the longer prose; title fields untouched.
Tests (5): `src/content/claims.test.ts`, `src/content/learn-L2.claims.test.ts`,
`src/content/registry/hands/k2.test.ts`, `k4.test.ts`, `src/content/registry/blog/stories/s2.test.ts`.
No test weakened; no test file added. No `packages/*`, no `src/components/**`, no registry
title, no range tool touched.

## Tests run

- `pnpm vitest run --project fishtilt src/content src/features src/copy-guards.test.ts`:
  75 files, 1293 tests — 3 failed first (readMinutes drift hand-22/hand-t9s 2→3, `content.test.ts`,
  `k2.test.ts`, `k4.test.ts`); after the registry bump the 6 affected files re-ran 123/123 PASS;
  final re-run of `k4`, `s2`, `content`, `claims` after the last t9s wording tweak: 4 files, 86/86 PASS.
- `pnpm --filter @gto-self/fishtilt typecheck`: first run failed only in
  `src/components/RangeFilters.tsx` (another agent mid-edit); second run 0 errors.
- `pnpm exec eslint <10 changed TS files>`: exit 0. `prettier --check` on the same: clean after
  `--write` on `k4.test.ts` and `s2.test.ts` (TS only; MDX formatted by hand, never prettier).
- Not run (orchestrator's final gate): build, e2e, screenshots.

## Build/runtime evidence

None this WP (fast-finish mode). `tests/e2e/hands.spec.ts:20` asserts the hub H1 text
`홀덤 시작 핸드 목록`, which is unchanged; the `<title>` is not e2e-pinned.

## Known limitations

- Hand pages still say 승률 for pot share in ~55 places (consistent with the definition; the
  hands hub's own per-hand §5 explains the ties-split meaning).

## Open issues (outside my boundary — exact changes for the orchestrator)

1. `apps/fishtilt/src/components/tools/EquityGuide.tsx:102` still reads
   `<strong>내 핸드 승률 · 비김 · 상대.</strong>` — should become
   `<strong>내가 이김 · 비김 · 상대가 이김.</strong>` (or interpolate `EQUITY_HERO_LABEL` /
   `EQUITY_TIE_LABEL` / `EQUITY_VILLAIN_LABEL` from `features/tools/equity.ts`). The sentence's
   logic ("왼쪽과 오른쪽 숫자에는 비김의 절반씩이 들어 있지 않습니다") is already correct.
2. `src/components/ToolAnswer.test.tsx:53/56` uses the literal `내 핸드 승률` as arbitrary child
   text — harmless, but could be renamed for hygiene.
3. `src/features/tools/equity.ts` JSDoc referenced the "build spec's worked example" labels; the
   spec doc (if any) still shows `내 핸드 승률` and should be updated by whoever owns it.

## Exact facts next agent may rely on

- `EQUITY_HERO_LABEL === '내가 이김'`, `EQUITY_TIE_LABEL === '비김'`, `EQUITY_VILLAIN_LABEL === '상대가 이김'`.
- EQUITY_FAQ question strings unchanged (`승률(Equity)이 뭔가요?` still anchors `equity/page.test.tsx:28`).
- Hub `<title>`: `홀덤 시작 핸드 목록 — 패별 순위·조합 수·기대 몫`.
- All numbers in the "Facts verified" table above are engine outputs from this session.

## Facts next agent MUST re-check

- If `HAND_STRENGTH` is regenerated: 22's "반반에 가깝다" (±5pp pin) and the 18/60 equal/split
  counts (pinned only as >0 each) — the prose does not print the counts.
- Any later edit to `learn/equity.mdx`'s definition must keep FAQ #1 in `faq.ts` in step.
