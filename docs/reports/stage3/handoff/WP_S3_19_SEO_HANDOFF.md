# WP-S3-19 — SEO remediation (Review C findings C-M1, C-M2, C-m2)

## Objective
Fix exactly three accepted findings from `docs/reports/stage3/review/WP_S3_18_REVIEW_C.md`:
1. C-M1: put the Korean headword (`TERM_HEADWORD`) into every glossary `title` that lacked it.
2. C-M2: make the four highest-value beginner learn pages state their head query in the title.
3. C-m2: gate a Vercel preview deployment with `X-Robots-Tag: noindex`; document it in DEPLOY §5.2.
No layout/component, MDX prose, or `src/lib/seo/**` change.

## Facts verified before work
- `LearnRecord` has NO `seoTitle` (only `BlogRecord` does; `graph.ts#seoTitleOf` reads it for
  `kind === 'blog'` only). So the four learn fixes change `title` itself → the H1 changes too.
- Glossary `title` is the `<title>`, the `<h1>` (`GlossaryTermHeader`), and the breadcrumb label.
  The names line below the H1 already prints the headword separately (`data-glossary-headword`).
- Exact-substring check `title.includes(TERM_HEADWORD[slug])`: 56/64 records lacked it (the review's
  45 counted alias matches too). All 56 were changed; the 8 that already led with the headword
  (`big-blind`, `small-blind`, `vpip`, `pfr`, `button`, `cutoff`, `hijack`, `hand-ranking`) are untouched.
- Every old glossary title had the shape `<gloss> (<Latin>)`; the script asserted this and that each
  `title: '…'` needle was unique in its batch file.
- Test pins on old titles: `tests/e2e/glossary.spec.ts:148` (exact H1 `패의 묶음 (Range)`) and
  `tests/e2e/search.spec.ts` (regex `/패의 묶음/`, still satisfied by the new title). Unit tests in
  `src/features/search/*.test.ts`, `SearchResultList/SearchClient/GlossaryTermHeader.test.tsx`,
  `jsonLd.test.ts` use self-contained fixture literals, not the registry — untouched, still green.
- `next.config.ts` had no `headers()`; `.next/routes-manifest.json` `headers: []`.
  `src/lib/locale.test.ts` reads `next.config.ts` text (locale-literal check) — unaffected.

## Decisions made
- Glossary title pattern (review's suggested minimal change): `<headword> (<Latin>) — <old gloss>`,
  e.g. `쓰리벳 (3-Bet) — 다시 거는 세 번째 레이즈`. Headword first (the searched word), Latin term
  kept in parentheses, the human gloss kept verbatim after an em dash — same dash convention the site's
  tool titles already use. Nothing invented: headword from `TERM_HEADWORD`, Latin from the old title.
- Learn titles follow `3BETTILT_KEYWORD_MAP.md` §2 proposals, except `poker-hand-rankings`, where the
  proposal ("홀덤 족보 9가지 강한 순") would type a rank count from agent knowledge (rule 3); the old
  question H1 is kept as the gloss instead.
- `headers()` gate returns `[]` unless `VERCEL_ENV === 'preview'`; no change to `robots.ts`,
  `policy.ts`, `metadata.ts` or canonical/og/sitemap (D-S3-05 intact).
- Added a regression guard: `categories.test.ts` "appears in every title" — every glossary title must
  contain its headword.

## Files changed (16)
- `apps/fishtilt/src/content/registry/glossary/g1.ts` … `g9.ts` — 56 titles (table below)
- `apps/fishtilt/src/content/registry/glossary/categories.ts` — doc comment describing title shape
- `apps/fishtilt/src/content/registry/glossary/categories.test.ts` — new headword-in-title test
- `apps/fishtilt/src/content/registry/learn/h1.ts` (3 titles), `h2.ts` (1 title)
- `apps/fishtilt/next.config.ts` — `headers()` preview gate
- `apps/fishtilt/tests/e2e/glossary.spec.ts:148` — H1 pin `패의 묶음 (Range)` → `레인지 (Range) — 패의 묶음`
  (assertion strength unchanged: still exact-name H1); `tests/e2e/search.spec.ts:12` comment only
- `docs/DEPLOY_3BETTILT.md` — §0 env-var row, §5.2 rewritten, §9 row 7a, appendix A-6

## Learn titles (C-M2) — title AND H1 change (no `seoTitle` on LearnRecord)
| slug | old | new |
|---|---|---|
| `holdem-basics` | 텍사스 홀덤은 어떻게 진행될까요? | 텍사스 홀덤 하는 법 — 규칙과 한 판의 흐름 |
| `poker-hand-rankings` | 어떤 족보가 더 강할까요? | 포커 족보 순서 — 어떤 족보가 더 강할까요? |
| `starting-hands` | 처음 받은 두 장, 좋은 패일까요? | 홀덤 시작 핸드 보는 법 — 수티드·커넥터·포켓 페어 |
| `positions-6max` | UTG · HJ · CO · BTN · SB · BB, 여섯 자리의 이름 | 6맥스 포지션 이름 — UTG·HJ·CO·BTN·SB·BB |

## Glossary titles (C-M1) — 56 changed
| slug | old | new |
|---|---|---|
| `ante` | 모두가 내는 참가비 (Ante) | 앤티 (Ante) — 모두가 내는 참가비 |
| `blind` | 강제로 내는 돈 (Blind) | 블라인드 (Blind) — 강제로 내는 돈 |
| `stack` | 내 앞의 칩 (Stack) | 스택 (Stack) — 내 앞의 칩 |
| `pot` | 판에 쌓인 돈 (Pot) | 팟 (Pot) — 판에 쌓인 돈 |
| `heads-up` | 둘만 남은 상황 (Heads-Up) | 헤즈업 (Heads-Up) — 둘만 남은 상황 |
| `showdown` | 카드를 열어 승부를 가리는 순간 (Showdown) | 쇼다운 (Showdown) — 카드를 열어 승부를 가리는 순간 |
| `preflop` | 공용 카드가 열리기 전 (Preflop) | 프리플랍 (Preflop) — 공용 카드가 열리기 전 |
| `flop` | 처음 열리는 공용 카드 세 장 (Flop) | 플랍 (Flop) — 처음 열리는 공용 카드 세 장 |
| `turn` | 네 번째 공용 카드 (Turn) | 턴 (Turn) — 네 번째 공용 카드 |
| `river` | 마지막 공용 카드 (River) | 리버 (River) — 마지막 공용 카드 |
| `board` | 테이블 가운데 깔린 카드 (Board) | 보드 (Board) — 테이블 가운데 깔린 카드 |
| `community-cards` | 모두가 같이 쓰는 카드 (Community Cards) | 커뮤니티 카드 (Community Cards) — 모두가 같이 쓰는 카드 |
| `action` | 내 차례의 행동 (Action) | 액션 (Action) — 내 차례의 행동 |
| `check` | 돈을 걸지 않고 넘기기 (Check) | 체크 (Check) — 돈을 걸지 않고 넘기기 |
| `bet` | 처음 돈을 거는 것 (Bet) | 베팅 (Bet) — 처음 돈을 거는 것 |
| `call` | 같은 금액 맞추기 (Call) | 콜 (Call) — 같은 금액 맞추기 |
| `raise` | 금액을 올리기 (Raise) | 레이즈 (Raise) — 금액을 올리기 |
| `fold` | 패를 접는 것 (Fold) | 폴드 (Fold) — 패를 접는 것 |
| `all-in` | 가진 칩 전부 (All-in) | 올인 (All-in) — 가진 칩 전부 |
| `open-raise` | 아무도 들어오지 않았을 때 처음 거는 레이즈 (Open Raise) | 오픈 레이즈 (Open Raise) — 아무도 들어오지 않았을 때 처음 거는 레이즈 |
| `limp` | 레이즈 없이 최소 금액만 맞춰 들어가기 (Limp) | 림프 (Limp) — 레이즈 없이 최소 금액만 맞춰 들어가기 |
| `three-bet` | 다시 거는 세 번째 레이즈 (3-Bet) | 쓰리벳 (3-Bet) — 다시 거는 세 번째 레이즈 |
| `four-bet` | 그 다음 레이즈 (4-Bet) | 포벳 (4-Bet) — 그 다음 레이즈 |
| `c-bet` | 앞선 공격자가 이어서 거는 베팅 (C-Bet) | 컨티뉴에이션 벳 (C-Bet) — 앞선 공격자가 이어서 거는 베팅 |
| `bluff` | 약한 패로 거는 베팅 (Bluff) | 블러프 (Bluff) — 약한 패로 거는 베팅 |
| `position` | 내 차례가 오는 자리 (Position) | 포지션 (Position) — 내 차례가 오는 자리 |
| `utg` | 첫 번째 자리 (UTG) | 언더 더 건 (UTG) — 첫 번째 자리 |
| `ip-oop` | 상대보다 늦게 행동하나요, 먼저 행동하나요 (IP / OOP) | 인포지션 (IP / OOP) — 상대보다 늦게 행동하나요, 먼저 행동하나요 |
| `high-card` | 아무것도 만들어지지 않은 패 (High Card) | 하이카드 (High Card) — 아무것도 만들어지지 않은 패 |
| `one-pair` | 한 쌍 (One Pair) | 원페어 (One Pair) — 한 쌍 |
| `two-pair` | 두 쌍 (Two Pair) | 투페어 (Two Pair) — 두 쌍 |
| `three-of-a-kind` | 같은 숫자 세 장 (Three of a Kind) | 트리플 (Three of a Kind) — 같은 숫자 세 장 |
| `set-vs-trips` | 셋과 트립스, 만들어지는 방식의 차이 (Set vs Trips) | 셋 vs 트립스 (Set vs Trips) — 셋과 트립스, 만들어지는 방식의 차이 |
| `straight` | 숫자가 연달아 다섯 장 (Straight) | 스트레이트 (Straight) — 숫자가 연달아 다섯 장 |
| `flush` | 같은 무늬 다섯 장 (Flush) | 플러시 (Flush) — 같은 무늬 다섯 장 |
| `full-house` | 셋과 페어를 함께 (Full House) | 풀하우스 (Full House) — 셋과 페어를 함께 |
| `four-of-a-kind` | 같은 숫자 네 장 (Four of a Kind) | 포카드 (Four of a Kind) — 같은 숫자 네 장 |
| `straight-flush` | 같은 무늬로 연달아 다섯 장 (Straight Flush) | 스트레이트 플러시 (Straight Flush) — 같은 무늬로 연달아 다섯 장 |
| `kicker` | 순위를 가르는 옆 카드 (Kicker) | 키커 (Kicker) — 순위를 가르는 옆 카드 |
| `split-pot` | 팟을 나눠 갖는 것 (Split Pot) | 스플릿 팟 (Split Pot) — 팟을 나눠 갖는 것 |
| `nuts` | 그 보드에서 나올 수 있는 가장 강한 패 (Nuts) | 넛 (Nuts) — 그 보드에서 나올 수 있는 가장 강한 패 |
| `draw` | 아직 완성되지 않은 패 (Draw) | 드로우 (Draw) — 아직 완성되지 않은 패 |
| `outs` | 내 패를 완성시키는 남은 카드 (Outs) | 아웃츠 (Outs) — 내 패를 완성시키는 남은 카드 |
| `equity` | 내 승률 (Equity) | 에퀴티 (Equity) — 내 승률 |
| `pot-odds` | 콜 값어치 (Pot Odds) | 팟오즈 (Pot Odds) — 콜 값어치 |
| `gutshot` | 한 장만 있으면 되는 스트레이트 드로우 (Gutshot) | 거트샷 (Gutshot) — 한 장만 있으면 되는 스트레이트 드로우 |
| `open-ended` | 양쪽으로 완성되는 스트레이트 드로우 (Open-Ended) | 오픈엔디드 (Open-Ended) — 양쪽으로 완성되는 스트레이트 드로우 |
| `hand` | 내가 들고 있는 패 (Hand) | 핸드 (Hand) — 내가 들고 있는 패 |
| `suited` | 같은 무늬 (Suited) | 수티드 (Suited) — 같은 무늬 |
| `offsuit` | 다른 무늬 (Offsuit) | 오프수트 (Offsuit) — 다른 무늬 |
| `pocket-pair` | 같은 숫자 두 장 (Pocket Pair) | 포켓 페어 (Pocket Pair) — 같은 숫자 두 장 |
| `combo` | 무늬까지 따진 한 가지 조합 (Combo) | 콤보 (Combo) — 무늬까지 따진 한 가지 조합 |
| `range` | 패의 묶음 (Range) | 레인지 (Range) — 패의 묶음 |
| `hand-matrix` | 13×13 표 (Hand Matrix) | 핸드 매트릭스 (Hand Matrix) — 13×13 표 |
| `broadway` | 10 이상의 다섯 숫자 (Broadway) | 브로드웨이 (Broadway) — 10 이상의 다섯 숫자 |
| `connector` | 숫자가 붙거나 한 칸 뜬 두 장 (Connector / Gapper) | 커넥터 (Connector / Gapper) — 숫자가 붙거나 한 칸 뜬 두 장 |

## Tests run
- `pnpm --filter @gto-self/fishtilt typecheck` — PASS
- `pnpm vitest run --project fishtilt src/content 'src/app/[locale]/glossary' 'src/app/[locale]/learn' src/lib/seo src/lib/locale.test.ts` — 44 files / 982 tests PASS
- Full `pnpm vitest run --project fishtilt` — 223 files / 2496 tests PASS (before the final
  positions-title compaction; `src/content` re-run after it: 31 files / 781 PASS)
- `pnpm exec eslint` on changed src/tests/next.config — clean; prettier — clean on all edited files
- `headers()` evaluated directly: `VERCEL_ENV=preview` → `[{source:'/:path*',headers:[{X-Robots-Tag:noindex}]}]`;
  `production` → `[]`; unset → `[]`
- ONE build via build-lock (`rm -rf .next && pnpm build`) — exit 0; then
  `playwright test tests/e2e/glossary.spec.ts tests/e2e/seo.spec.ts` — 45 passed (10.1 s).
  Logs: `apps/fishtilt/.data/wp19-build.log`, `apps/fishtilt/.data/wp19-e2e.log`.

## Build/runtime evidence (built HTML, `.next/server/app/ko`)
- `glossary/three-bet.html`: `<title>쓰리벳 (3-Bet) — 다시 거는 세 번째 레이즈 · 3BetTilt</title>`; H1 same text;
  breadcrumb item name same; `DefinedTerm.name: "쓰리벳"`; `<meta robots>` `index, follow` (unchanged).
- Learn `<title>`s: the four new titles above, each with ` · 3BetTilt` suffix.
- `.next/routes-manifest.json` `headers: []` — production build output unchanged by the gate.
- No duplicate `<title>` across `glossary/*.html` (seo.spec "distinct title" test also passed).
- No screenshots (text-only change; not required by task).

## Known limitations
- The four learn H1s changed with the titles (no `seoTitle` on learn). If a sentence-form H1 is wanted
  back, `seoTitle` must be lifted to `ContentRecord`/`LearnRecord` and `seoTitleOf` widened — out of scope.
- `positions-6max` title was compacted (`UTG·HJ·CO·BTN·SB·BB`) AFTER this WP's single build; unit tests
  re-run, e2e/build coverage comes from the orchestrator's final gate.
- Preview header is verified by evaluating the config, not on a real Vercel preview (no Vercel access).

## Open issues
- `apps/fishtilt/content/glossary/hand.mdx:13` links to `/learn/poker-hand-rankings` with the old
  link text `어떤 족보가 더 강할까요?` (MDX prose — out of boundary). Link still resolves; text is a
  subset of the new title. Optional follow-up: `포커 족보 순서`.
- C-m1 (glossary descriptions) was NOT accepted for this WP and is untouched.

## Exact facts next agent may rely on
- Every glossary `title` contains `TERM_HEADWORD[slug]` (enforced by `categories.test.ts`).
- `headers()` in `next.config.ts` is the only env-dependent SEO code; it reads `VERCEL_ENV` only.
- e2e H1 pin for `/ko/glossary/range` is `레인지 (Range) — 패의 묶음`.

## Facts next agent MUST re-check
- Full e2e suite (hub/learn/search specs) on the final tree — only glossary+seo were run here.
- First real Vercel preview: `curl -I https://<preview>.vercel.app/ko | grep -i x-robots-tag`.
