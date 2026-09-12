# WP-K5 — Korean glossary, external HUD panel, narrative reason line

Continues K1-K4. Covers `prompt` §8 (narrative "왜 이렇게 추천하나요") and §9 (용어 설명 —
plain-Korean glossary), plus the panel wiring K1's schema/repository needed to actually
reach the screen.

## 1. Glossary (`prompt` §9)

`apps/web/src/lib/table/copy.ts` gains `ExternalHudGlossaryKey` (a purpose-built 10-member
union — not `ExternalHudStatKey` itself, to avoid a `player-core` type import into a
presentation-only, React-free file), `EXTERNAL_HUD_GLOSSARY_ORDER`, and
`EXTERNAL_HUD_GLOSSARY: Readonly<Record<ExternalHudGlossaryKey, string>>` carrying
`prompt` §9's Korean text verbatim (VPIP, PFR, 3-Bet, Fold to 3-Bet, C-Bet, Fold to C-Bet,
Steal, Check/Raise, WTSD, WSD). `EXTERNAL_HUD_UNKNOWN_LABEL = '알 수 없음'` is the one
string ever shown for a stat the source did not report.

## 2. `PlayerProfilePanel` — external HUD section

New contract type `ProfileExternalHudSnapshot` (`apps/web/src/lib/table/contract.ts`):
`recordedAt`, `sampleN: null` (unconditionally — this source never reports a hand count),
`stats: readonly ProfileHudStat[]`. `PlayerProfileView.externalHud: ProfileExternalHudSnapshot | null`
is a new required field — TypeScript's exhaustiveness caught every existing fixture site
across `PlayerProfilePanel.test.tsx` and `TableRoot.test.tsx` as a compile error, which is
exactly the safety net that shape of change is meant to trip.

`apps/web/src/server/players.ts`'s `buildProfileView` now also calls
`latestExternalProfileForPlayer` and maps its result the same way the manual HUD is mapped
(a DB read failure is a warning, not a fatal error — matching the existing manual-HUD
convention).

The panel renders a new, separately-labelled "외부 HUD (전체 기간)" section — never
interleaved with "최근 HUD" (ADR-0069) — iterating `EXTERNAL_HUD_GLOSSARY_ORDER` so all 10
categories always appear in a fixed order, each with the glossary text as a `title` and
the entered value or `EXTERNAL_HUD_UNKNOWN_LABEL` as its value. Verified: a profile missing
WTSD/WSD (Ssallabd/Dre4mTe4m's actual shape) renders `알 수 없음` for exactly those two
rows and never `0%`.

## 3. `StrategyPanel` — visible narrative line (`prompt` §8)

`ADAPTIVE_RULE_LABEL` already reads as the exact "관찰 → 반영" sentence shape `prompt` §8
asks for (e.g. `'CBET 폴드 높음 → 공격 빈도 증가'`), but it was previously wired only as a
hover `title` on the reason `<li>` — which fails §8's own closing instruction, "tooltip에만
의존하지 말고... 사람이 읽을 수 있게 한다." `ReasonRow` now also renders it as a second,
always-visible line (`data-testid="adaptive-reason-narrative-{ruleId}"`), directly beneath
the existing data-dense line (opponent, stat, value, n, confidence, reason label, cap).
Nothing was recomputed or newly authored here — the sentence text is the same
`ADAPTIVE_RULE_LABEL` value the exhaustive `Record` already required for every
`AdaptiveRuleId`, including `SIZE_WINNER_VALUE_UP` (K3).

The existing "기본전략 / OO 반영 / 근거" block (`adaptive-baseline`,
`adaptive-primary-changed`, `adaptive-delta`, `adaptive-provenance` test ids) already
matches `prompt`'s own mockup and reuses computed baseline-vs-adaptive data with no new
recomputation — left unchanged.

## 4. Tests

- `PlayerProfilePanel.test.tsx`: two new tests — "no external HUD" render, and a profile
  with two present stats and two (WTSD/WSD) absent, asserting the absent ones render
  `알 수 없음` and explicitly asserting the text does NOT contain `0%`.
- `players.test.ts`: two new tests exercising `buildProfileView`'s external-HUD mapping
  through the DB (via the existing `saveHudSnapshot`-returns-the-profile pattern, since
  `buildProfileView` itself is not exported) — a full round trip through a real
  `insertExternalHudSnapshot` call, and the never-imported case.
- `StrategyPanel.test.tsx`: extended the existing full-panel integration test with an
  assertion that the new narrative line's text equals `ADAPTIVE_RULE_LABEL[ruleId]`.

## 5. Verification

- `pnpm --filter @gto-self/web typecheck` — clean.
- `pnpm vitest run --project web` — 481/481 passed (4 new), 3 skipped (pre-existing,
  unrelated).
