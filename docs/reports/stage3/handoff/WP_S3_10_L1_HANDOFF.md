# WP-S3-10 L1 — Learn content enrichment, batch L1 (lessons 1–5)

## Objective

`holdem-basics`, `poker-hand-rankings`, `starting-hands`, `starting-hand-ranking`, `hand-matrix`를
WP-S3-09 템플릿(`<LessonGoals>`/`<LessonSummary>`)에 맞추고, 감사 §3의 필수 결정적 시각과 빠진
개념을 넣고, §6.1 NUMBER-RISK(#1 ERROR, #25)를 닫고, 레지스트리 관계 필드를 채운다. 순서·`nextLessons`
불변. 이 WP는 앞선 에이전트가 22:19에 중단된 것을 이어받아 마무리했다(복원 없음, 검수 후 보완).

## Facts verified before work

- 이어받은 시점: 5편 MDX 모두 Goals/Summary·시각·개념 추가 완료, `h1.ts` 관계 필드 갱신 완료,
  `learn-L1.claims.test.ts` 4 describe 존재. `src/content` 유닛: L1 파일 실패 0(실패 1건은 L2 파일,
  이후 L2 에이전트가 해결).
- 베이스라인은 `.data/stage3-baseline/apps/fishtilt/…`(브리프의 경로와 다름). 5편 diff로 앞선 작업 전수 확인.
- 엔진: `handClassByKey('KQs')` 콤보 4개, 전부 같은 무늬(♠♠ ♥♥ ♦♦ ♣♣); KQo 12개, 전부 다른 무늬.
- `RFI_POSITIONS_WITH` AKs == AKo(같은 자리 목록, 5석) → 베이스라인 `starting-hands` 본문·FAQ의
  "같은 무늬 쪽이 더 여러 자리에서 쓰인다"는 **거짓**(감사에 없던 미기록 오류). 수티드/오프수트 78쌍 중
  자리 목록이 갈리는 쌍은 존재하고, 오프수트가 열리는 자리는 항상 수티드도 열림(테스트로 고정).
- `HAND_STRENGTH_BY_RANK`: 1~7위 전부 페어, 8위 AKs, 169위 32o(≠72o), 169위 equity 0.30~0.36.
- `categoryFrequencyOf`: 9족보 rank↑ ⇔ count↓ 단조.
- `measureContent`는 JSX 속성을 세지 않음 → Goals/Summary는 `readMinutes` 불변.

## Decisions made

- holdem-basics 시각은 `HandTimeline`이 아닌 `<Timeline>`(6단계, 판 시작→프리플랍→플랍→턴→리버→판 끝).
  이유: 이 레슨은 액션/금액 없이 단계만 나열(WP-09 how-to가 허용한 대안). 숫자 0.
- poker-hand-rankings 빈도표는 `ComparisonTable`이 아닌 `DataTable`(족보·순위·조합 수, 9행). 이유:
  옵션×기준 비교가 아니라 한 표의 열거. 셀은 전부 `CATEGORY_RANK`/`CATEGORY_FREQUENCY` Fact.
- starting-hand-ranking `StatsRow` 3칸(1위·8위·169위): 라벨의 "1위/8위/169위"는 rank 인자와 동일한
  구조 라벨, 값은 `HAND_AT_RANK`+`HAND_EQUITY_VS_RANDOM` Fact. 테스트가 rank↔key 일치를 고정.
- Goals/Summary 계약을 L2와 동일하게 L1 테스트로 고정: 항목 2–4개, 작은따옴표 없음, 숫자 없음(13×13만
  라벨로 허용). 이에 맞춰 앞선 초안의 숫자(169가지·8위·72o·10부터·1위)를 무숫자 문장으로 바꾸고
  holdem-basics 요약 5줄→4줄로 합침.
- `starting-hands` 오류 수정 문안: 본문 "AK처럼 강한 패는 무늬와 상관없이 여러 자리에서 쓰입니다 …
  숫자가 더 낮은 패로 내려가면 … 갈리는 칸이 나옵니다", FAQ "AKs와 AKo처럼 … 자리가 똑같은 경우도
  있습니다". 둘 다 테스트로 고정.
- `relatedHands`: holdem-basics·hand-rankings는 빈 채로 둠 — 핸드 스토리 20편이 전부 시작 패 페이지라
  규칙/족보 레슨과 실제 관련이 없음(가짜 관계 금지). 나머지 3편은 본문에 등장하는 패로 채움.
- 감사 §3 glossary 추가(button·stack·community-cards / hand·combo)는 본문 `<Term>` 첫 언급 + 레지스트리
  `relatedConcepts` 양쪽에 반영(h1.test "모든 Term은 relatedConcepts에" 규칙).

## Files changed

- `apps/fishtilt/content/learn/holdem-basics.mdx` — Goals 4 · Summary 4 · `<Term>` button/stack/
  community-cards · 버튼 이동·스택 단락 · `<Figure><Timeline 6단계/></Figure>` · FAQ +1(스택<팟).
- `apps/fishtilt/content/learn/poker-hand-rankings.mdx` — Goals 4 · Summary 4 · `<Term>` one-pair/
  two-pair/four-of-a-kind · 빈도 `DataTable`(9행) · "같은 족보 비교"(투페어·풀하우스 예 PokerCards 4개) ·
  FAQ +1.
- `apps/fishtilt/content/learn/starting-hands.mdx` — Goals 4 · Summary 4 · `<Term>` hand/combo ·
  `RangeMatrixMini`(UTG/BTN, AKs·AKo 칸) · 수티드 커넥터/갭/브로드웨이 단락 · FAQ +1 · **AKs/AKo
  자리 오류 수정(본문+FAQ)**.
- `apps/fishtilt/content/learn/starting-hand-ranking.mdx` — Goals 4 · Summary 4 · "맨 위/8위/169위"
  섹션 + `StatsRow` 3칸.
- `apps/fishtilt/content/learn/hand-matrix.mdx` — Goals 3 · Summary 4 · **:24 KQs 무늬 목록 수정** ·
  KQo 4×3 설명 · KK 칸(6가지) PokerCards 추가.
- `apps/fishtilt/src/content/registry/learn/h1.ts` — relatedConcepts/Tools/Hands/Articles 갱신,
  readMinutes 5/6/5/5/5(content.test 계산값). order·nextLessons·prerequisites 불변.
- `apps/fishtilt/src/content/learn-L1.claims.test.ts` — 신규(앞선 에이전트 4 describe + 이번 3 describe).
- `h1.test.ts` 무수정(기존 규칙 그대로 통과).

## Tests run

- `pnpm vitest run --project fishtilt src/content` → **21 files / 507 tests PASS**(L1 claims 16,
  h1.test 17 포함; content.test·graph.test·claims.test 통과).
- `pnpm --filter @gto-self/fishtilt typecheck` → 0 오류. `eslint` L1 test·h1.ts·h1.test.ts → 0.
- prettier: 편집 파일만.

## Build/runtime evidence

- build-lock `rm -rf .next && pnpm build` → exit 0(정적 ○/● 만).
- `artifacts/3bettilt-stage3-visual-qa/wp10-L1/` 12장: holdem-basics · poker-hand-rankings ·
  starting-hand-ranking × 1440x900/390x844 × dark/light. shoot.mjs: h1 1개, 44px/30px, main 736/390,
  **overflowX 0 전부**.
- 육안(크롭 확인): 390 Timeline 6단계 번호 레일·meta 라벨 정상, 요약 KeyPoint 정상; StatsRow 390에서
  2+1 랩, 값 `AA · 85.20%` 등 잘림 없음; DataTable 390/1440 양 테마 3열 숫자 우측 정렬, 천 단위 구분
  Fact 출력; 키커·투페어·풀하우스 PokerCards 정상.

## Known limitations

- `starting-hands`의 "갈리는 칸이 나옵니다"는 존재 주장(어느 칸인지 명시 안 함) — 독자가 표에서 찾는
  구조. 테스트가 존재를 고정.
- `hand-matrix` 시각은 감사대로 RangeEmbed+PokerCards(4/12/6)이며 별도 Figure 없음.
- holdem-basics·hand-rankings `relatedHands` 빈 배열 유지(위 결정).

## Open issues

- 없음(내 경계 밖 수정 필요 없음). 감사 문서 §6.1에 없는 오류(starting-hands AKs/AKo 자리 주장)를
  발견·수정했으니 orchestrator가 감사 표에 항목 추가를 고려.

## Exact facts next agent may rely on

- L1 5편 모두: `<LessonGoals>`는 첫 `##` 앞, `<LessonSummary>`는 `## 사람들이 자주 헷갈리는 부분` 직전,
  항목 2–4, 숫자·작은따옴표 없음(테스트 고정).
- L1 필수 시각 마커(테스트 고정): holdem-basics `<Timeline`, hand-rankings `<DataTable`,
  starting-hands `<RangeMatrixMini`, starting-hand-ranking `<StatsRow`+`<RangeMatrixMini`, hand-matrix
  `<RangeMatrixMini` + PokerCards KQs/KQo/KK.
- 고정된 데이터 관계: KQs 콤보 4(같은 무늬만) · KQo 12 · 페어 콤보 동일 · AKo=3×AKs · 1~7위 페어,
  8위 비페어 · 169위≠72o · AKs/AKo RFI 자리 동일 · 오프수트 자리 ⊆ 수티드 자리(78쌍 전수).
- readMinutes: holdem-basics 5, hand-rankings 6, starting-hands 5, starting-hand-ranking 5, hand-matrix 5.

## Facts next agent MUST re-check

- 레인지 데이터셋이 바뀌면 `learn-L1.claims.test.ts` "AKs and AKo … SAME first-in seats"와 "some lower
  rank pair IS split"이 먼저 깨진다 — 그때 starting-hands 본문·FAQ 문장을 데이터에 맞게 다시 쓸 것.
- 본문 문장을 추가/삭제하면 `h1.test.ts`/`content.test.ts`가 `readMinutes` 재계산값을 요구한다.
- `starting-hand-ranking` StatsRow의 `HAND_EQUITY_VS_RANDOM` arg(AA/AKs/32o)는 `HAND_AT_RANK` 1/8/169와
  일치해야 한다(테스트 고정) — 순위 데이터가 바뀌면 arg도 바꿔야 한다.
