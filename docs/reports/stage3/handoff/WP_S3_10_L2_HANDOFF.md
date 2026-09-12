# WP-S3-10 L2 — Learn content enrichment (poker-range, position, positions-6max, poker-actions, preflop)

## Objective

감사 §3의 L2 다섯 편을 시각 레슨으로 보강: `<LessonGoals>`/`<LessonSummary>`, 필수 결정적 시각,
빠진 개념, NUMBER-RISK 항목, 레지스트리 관계 필드. 이 handoff는 **재개(resume)** 결과다 — 이전
에이전트가 사용량 한도로 중단된 뒤 디스크 상태를 점검·마무리했다. 되돌린 파일 없음.

## Facts verified before work

- 이전 에이전트의 편집 5 MDX + `h2.ts` + `published.ts` + `learn-L2.claims.test.ts` 전부 디스크에 존재.
  브리프 항목별 점검 결과 누락 없음(아래 "Files changed"). 실패 1건뿐: 자기 테스트의 typed-digit 규칙.
- MDX가 쓰는 prop 형태를 컴포넌트 소스와 대조: `PositionDiagram.highlight`는
  `StrategyPosition | readonly StrategyPosition[]`(배열 OK), `DataTableColumn.align/numeric`,
  `ComparisonRow.cells`(option key record), `StatsRow.items[{label,value,note}]`,
  `RangeMatrixMini.positions/initial/showSelection`, `PokerCards.cards + showReading`,
  `BettingTimeline.steps[{position,action,amount?,note?,hero?}] + label + caption` — 전부 일치.
- Fact 이름 9종(`COMBO_COUNT, HAND_CLASS_COUNT, CLASSES_OF_KIND, COMBOS_OF_KIND, HAND_COMBOS,
  HAND_SHARE, RFI_COMBOS, RFI_PERCENT, RFI_POSITIONS_WITH`) 모두 `facts.ts` 등록 목록에 존재.
- 관계 id 존재 확인: glossary 28개(`term-*`), blog 6개, hand 6개 전부 registry에 있음.
  route id `range, practiceRange, toolPotOdds, toolStartingHand, practice` 전부 `routes.ts`에 있음.
- 베이스라인(`.data/stage3-baseline/apps/fishtilt/content/learn/`) 대비 삭제된 줄 검토: 전부
  재작성/치환(문단 리플로우, AJo→AJs·ATo→AQo 예시 교체, 퀴즈 2문항 교체). 의미 손실 없음.
- 시작 상태 unit: content 스위트 497/499(실패 2건 모두 `outs` readMinutes — L3 경계).

## Decisions made

- **typed-digit 규칙 정밀 예외**(brief 지시): `[34](?:벳|-?[Bb]et)`를 라벨 토큰으로 제거한 뒤 `\d`
  검사. 근거: 3벳/4벳/3-Bet은 glossary가 `three-bet`/`four-bet`으로 등록한 용어이며 숫자는 용어의
  일부다. 삭제가 아니라 예외라 "2.5BB", "5가지" 같은 실제 타이핑 숫자는 계속 잡힌다.
  문장 재작성 대신 규칙 예외를 택한 이유: preflop 요약의 "콜과 3벳 레인지는 지원하지 않습니다"가
  감사 §3 #12 "3벳 레인지 미지원 고지"를 그대로 담는 문장이라 유지가 옳다.
- **모바일 DataTable 줄바꿈 수정**: 390px에서 BB 행의 '첫 레이즈 표 없음' 두 셀이 폭을 차지해
  행 헤더 "UTG"/"BTN"이 "UT/G"로 중간 줄바꿈됨(스크린샷으로 확인). 셀을 '표 없음'으로 줄임
  (caption·Callout이 이미 "첫 레이즈"를 명시). 내 테스트의 regex도 함께 갱신. 재촬영으로 해소 확인.
- 예시 핸드는 모두 **자체 페이지가 있는 핸드**로 통일(AJs, AQo, AA, 22)해 `relatedHands`가 본문
  예시와 1:1이 되게 함. 72o는 페이지가 없어 `blog-why-72o-is-weak`가 대신 관계를 맡음.
- BB 첫 레이즈 표 없음은 DataTable 행 + Callout + `RangeMatrixMini positions={['SB','BB']}`로
  "표 대신 이유"를 직접 보여줌(숫자 대체 없음).

## Files changed

| 파일 | 내용 |
| --- | --- |
| `content/learn/poker-range.mdx` | Goals 4·Summary 4. StatsRow(UTG/BTN `RFI_PERCENT`). 13×13 표 첫 언급 `<Term id="term-hand-matrix">`. 조건 Callout 강화: 6인·100BB·First In 한 조건뿐, 콜/재레이즈/다른 인원·스택 "지원하지 않음". FAQ 1개 추가(누군가 먼저 레이즈했을 때의 레인지 → 없음). RangeMatrixMini ×2 유지. |
| `content/learn/position.mdx` | Goals 4·Summary 4. **PositionDiagram**(highlight UTG·BTN, showButton). StatsRow(UTG/BTN). IP/OOP 절 신설(상대 기준). HJ/CO 첫 언급 `<Term>`. AA=다섯 자리 전부 vs 87s 대비(`RFI_POSITIONS_WITH`). 퀴즈 3번 IP/OOP로 교체. FAQ "인포지션이면 판 내내?" 추가. |
| `content/learn/positions-6max.mdx` | Goals 4·Summary 4. **PositionDiagram**(BTN, D 표식) + RangeMatrixMini(5자리) + **DataTable** 6행(자리·순서·`RFI_PERCENT`·`RFI_COMBOS`, BB는 '표 없음'). 버튼 시계 방향 이동 절. SB/BB 블라인드 `<Term>`. 22=SB뿐 예시. BB 표 없음 Callout + SB/BB 미니 표. |
| `content/learn/poker-actions.mdx` | Goals 4·Summary 4. **BettingTimeline ×2**(플랍 한 바퀴, 체크-레이즈; 금액은 "예시 크기" 명시). 올인 = 베팅/레이즈/콜 중 하나, 체크-레이즈 = 조합 개념. `<Term>` all-in·pot. **DataTable**(다섯 행동 언제/무엇). 예시 AJo→AJs. 퀴즈 3번 체크-레이즈. FAQ "정해진 만큼만?" 추가. |
| `content/learn/preflop.mdx` | Goals 4·Summary 4. **BettingTimeline ×2**(림프 1BB / 오픈 레이즈 2.5BB 예시) + **ComparisonTable**(림프 vs 오픈 4행, 표 지원 여부 포함). VPIP/PFR `<Term>`(계산 안 함 명시). 3벳 미지원 Callout(`term-three-bet`). 예시 ATo→AQo, 72o "한 자리도 없습니다". FAQ BB 체크 예외 보강. |
| `registry/learn/h2.ts` | position: relatedConcepts +hijack·cutoff, relatedTools +practiceRange, relatedHands [hand-aa], relatedArticles +why-use-range, readMinutes 6. positions-6max: relatedHands [hand-22], tools +practiceRange, articles +why-blinds-exist, readMinutes 6. poker-actions: relatedHands [hand-ajs]. preflop: concepts +vpip·pfr·three-bet·limp, relatedHands [hand-aqo], articles +why-72o-is-weak·why-blinds-exist. |
| `registry/learn/published.ts` | poker-range: relatedConcepts +term-hand-matrix, relatedArticles +blog-why-use-range. readMinutes 5 유지. |
| `src/content/learn-L2.claims.test.ts` | 신규 12 tests(아래). 이번 세션: 3벳/4벳 토큰 예외, BB 셀 regex. |
| `docs/reports/stage3/handoff/WP_S3_10_L2_HANDOFF.md` | 이 문서. |

`order`·`nextLessons` 무수정. categories/allowList/components 무수정.

## Number sources (every number in a visual)

- `RFI_PERCENT`/`RFI_COMBOS` (UTG·HJ·CO·BTN·SB) → `facts.ts` → `resolveRange({spot:'RFI', stackDepth:100, tableSize:6})`.
- `RFI_POSITIONS_WITH` 87s·AA·K9s·K9o·22·AQo·72o → 같은 경로(`'한 자리도 없습니다'` 문자열은 facts가 생성).
- `COMBO_COUNT, HAND_CLASS_COUNT, CLASSES_OF_KIND(PAIR/SUITED/OFFSUIT), COMBOS_OF_KIND, HAND_COMBOS AKs, HAND_SHARE AKs` → strategy-core 상수/`handClassByKey`.
- BettingTimeline 금액(3BB·9BB·1BB·2.5BB)은 **예시 크기** 문자열(감사 #21 관례) — 산술 없음, caption에 명시. 림프 1BB = BB 금액은 규칙(#22), 테스트로 고정.

## NUMBER-RISK closed

- #22 `preflop` 림프 = BB 금액(1BB): `learn-L2.claims.test.ts` "limp amount equals the big blind" 고정.
- 서술 주장 고정: "UTG가 가장 좁고 SB가 가장 넓습니다"(5자리 단조 증가 재도출), "22 → SB뿐",
  "AA → 다섯 자리 전부"(`WITH_RANGE.length===5`), "87s에 UTG 없음", "72o 한 자리도 없음",
  BB에 RFI 표 없음. 프로즈에 `%` 리터럴·조합 수 리터럴(226/280/368/568/622/1,326) 금지 검사.
- #1(hand-matrix) 등 타 파일 항목은 L1 경계.

## Tests run

- `vitest run --project fishtilt src/content/learn-L2.claims.test.ts` → **12/12 PASS**.
- `vitest run --project fishtilt src/content/learn-L2.claims.test.ts src/content/content.test.ts` → 53/53.
- `vitest run --project fishtilt src/content`(전체) → 1차 497/499, 실패 2건 모두 `outs` readMinutes
  (`content.test.ts`, `h3.test.ts` — L3 경계). 재실행 시 `content.test.ts` PASS(L3가 수정한 것으로 보임).
- `pnpm --filter @gto-self/fishtilt typecheck` → 0 오류. eslint(h2.ts, published.ts, 테스트) → 0.
- prettier --check(편집 파일 8개) → 통과.

## Build/runtime evidence

- build-lock `pnpm build` 2회 성공(137 static pages). `next start :3221` + shoot.mjs.
- `artifacts/3bettilt-stage3-visual-qa/wp10-L2/` 16장: `ko_learn_positions-6max`, `ko_learn_preflop`
  × 1440x900/390x844 × dark/light (+fold). 전부 status 200, h1 1개(44px/30px), main 736/390,
  **overflowX 0**. 육안(크롭): PositionDiagram 6석 원형·D 표식·BTN 강조 390에서 선명; BettingTimeline
  칩 2줄 랩 정상; ComparisonTable 3열 390 정상; DataTable 390 수정 후 UTG/BTN 한 줄. 라이트 테마
  표·Callout·요약 박스 정상.

## Known limitations

- DataTable 헤더 "전체 조합 중 비율"은 390에서 2줄로 랩(가독 OK, 컴포넌트 소관).
- LessonGoals/Summary는 문자열이라 숫자 불가 — 숫자는 전부 본문 `<Fact>`.
- preflop 림프 타임라인의 SB 블라인드 칩은 금액 없음(0.5BB를 타이핑하지 않기 위해 의도적 생략).

## Open issues

- 없음(내 경계). `outs` readMinutes 실패는 L3 소유 — 이번 세션 말미에는 통과.

## Exact facts next agent may rely on

- L2 5편 전부 `<LessonGoals>`(첫 `##` 앞)·`<LessonSummary>`(FAQ `##` 앞) 보유, items 4개, 따옴표 없음.
- 필수 시각 태그(테스트 고정): poker-range RangeMatrixMini+StatsRow · position PositionDiagram+StatsRow+
  RangeMatrixMini · positions-6max PositionDiagram+DataTable+RangeMatrixMini · poker-actions
  BettingTimeline×2+DataTable · preflop BettingTimeline×2+ComparisonTable+RangeMatrixMini.
- readMinutes: poker-range 5 · position 6 · positions-6max 6 · poker-actions 5 · preflop 5.
- relatedHands: position [hand-aa] · positions-6max [hand-22] · poker-actions [hand-ajs] · preflop
  [hand-aqo] · poker-range [hand-aks, hand-ako] — 테스트가 본문에 해당 키가 나오는지 검사.

## Facts next agent MUST re-check

- 레인지 데이터를 재생성하면 `learn-L2.claims.test.ts`의 서술 고정(SB 최광, 22=SB뿐, 87s∉UTG,
  72o 없음)이 먼저 깨진다 — 그때는 프로즈를 데이터에 맞춰 고칠 것, 테스트 완화 금지.
- typed-digit 예외 토큰은 `13×13|6인|100BB|1BB|[34](?:벳|-?[Bb]et)`뿐. 새 라벨이 필요하면 근거와
  함께 추가.
- L2 5편 본문을 한 문장이라도 늘리면 `content.test.ts`가 readMinutes 재계산값을 요구한다.
