# FishTilt WP-4 — 툴 UX 리파인

## 목표

무료 도구 6개(`/tools/range`, `/tools/starting-hand`, `/tools/equity`, `/tools/pot-odds`,
`/tools/outs`, `/tools/hand-checker`)를 한 제품처럼 만드는 것. 구체적으로 다섯 가지다.

1. **답이 항상 보인다.** 마지막 입력을 만진 직후, 스크롤하지 않고 결과를 읽을 수 있어야 한다.
   375px에서 실측으로 확인한다.
2. **레이아웃이 하나다.** 세 가지 페이지 골격을 하나로 통일한다 — 히어로 → 도구 → FAQ →
   레슨 → 다음 도구.
3. **Q&A 시스템이 하나다.** `ExplanationCard`와 `FaqSection`이 각각 질문에 답하는 상태를
   끝낸다. WP-7이 JSON-LD를 뽑을 수 있는 타입화된 단일 출처를 만든다(JSON-LD 자체는 만들지
   않는다 — WP-7 소관).
4. **막다른 길을 없앤다.** 플래그십 `/tools/range`에 온워드 링크가 하나도 없었다. 레슨 역링크는
   툴당 1개뿐이었고, `/about`으로 가는 링크는 6개 툴 전체에 0개였다.
5. **거짓 주석을 정정한다.** 이미 끝난 작업을 아직 안 끝났다고 말하는 주석이 남아 있었다.

지키기로 되어 있던 값 — 전략 조언 금지, UI에 "GTO" 없음, 숫자를 손으로 타이핑하지 않음, 정직한
빈 상태, 44px 터치 타깃, 13×13 모바일 동작 보존 — 은 전부 그대로 두는 것이 전제였다.

## 범위

**편집한 영역**

- `src/app/tools/page.tsx`, `src/app/tools/*/page.tsx` (6개) + 각 `page.test.tsx`
- `src/components/` 중 툴 소유 컴포넌트: `EquityCalculator`, `PotOddsCalculator`,
  `OutsCalculator`, `HandChecker`, `RangeExplorer`, `StartingHandExplorer`,
  `SelectedHandPanel`, 그리고 새로 만든 `ToolAnswer`, `ToolLessonLinks`
- `src/features/tools/**` (신규 `faq.ts`, `related.ts` 포함)
- `tests/e2e/{equity,pot-odds,outs,hand-checker,range-explorer,starting-hand,tools-hub}.spec.ts`

**건드리지 않은 영역**

- 홈(`src/app/page.tsx`), 다른 허브 페이지, `LinkCard.tsx`, `FaqSection.tsx`(사용만 하고
  재설계하지 않음), `RangeMatrix.tsx` / `RangeCompareMatrix.tsx`, `globals.css`, `routes.ts`,
  `src/lib/seo/**`, 콘텐츠 MDX와 레지스트리
- 13×13 매트릭스의 모바일 동작(608px 가로 스크롤러 + `↔` 큐 + `mobileCompareView` 전환).
  이미 옳게 풀린 문제라 손대지 않았다.
- WP-2 토큰. 새 토큰을 만들지 않았고, 하드코딩 색상도 넣지 않았다.

## 확인한 기존 상태

실측(WP-3/WP-4 정찰 시점, `apps/fishtilt` 기준):

| 툴 | 총 줄 수 | `<ToolCTA>` | 레슨 역링크 | `/about` 링크 |
| --- | --- | --- | --- | --- |
| `/tools/range` | 151 | **0** | 1 | 0 |
| `/tools/starting-hand` | 190 | 2 | 1 | 0 |
| `/tools/equity` | 162 | 1 | 1 | 0 |
| `/tools/pot-odds` | 162 | 1 | 1 | 0 |
| `/tools/outs` | 180 | 1 | 1 | 0 |
| `/tools/hand-checker` | 192 | 1 | 1 | 0 |

그 밖에 확인한 것:

- **레이아웃이 세 가지**였다. 컨테이너 폭은 6개 중 6개가 `max-w-[85rem]` — WP-2의 세 폭
  (`reading` 48rem / `grid` 56rem / `shell` 72rem) 어디에도 속하지 않는 네 번째 폭이었다.
- **`ExplanationCard`가 툴당 2~4회** 쓰였고, 그 대부분이 실제로는 질문–답 쌍이었다. 즉 사이트에
  Q&A 시스템이 사실상 두 개(`ExplanationCard` 손글씨 Q&A + `FaqSection`) 있었다.
- **레슨 역링크는 툴마다 `contentById` 호출 1건**, 그리고 그 카드를 그리는 `…LessonLink()`
  헬퍼가 6개 파일에 거의 같은 모양으로 복제돼 있었다.
- **`/tools` 허브에는 콘텐츠 역링크가 0개**였다. 툴 카드만 있고 "이 도구를 이해하려면 무엇을
  읽어야 하는가"에 대한 답이 없었다.
- **낡은 주석 2건**(MASTER 정정이 지목한 것과 동일):
  `tools/equity/page.tsx:40`의 "`PUBLISHED` (WP-H has not run yet), so `hrefOfContent`
  returns `null`", `tools/starting-hand/page.tsx:58`의 "`hrefOfContent` returns `null`
  until the lesson ships". 레슨 15개는 이미 전부 published라 두 문장 다 거짓이었다.
  코드는 옳았고 산문이 틀린 경우다.
- 정찰 보고서가 주장한 "PLANNED 때문에 죽은 카드"는 **사실이 아니었다**. 레지스트리 113개
  레코드는 전부 `PUBLISHED`다. 정찰을 속인 것이 위의 낡은 주석이었다.

## 구현 내용

### 여섯 툴 요약

| 툴 | 레이아웃 형태 | 결과 위치 | FAQ 처리 | 역링크 전→후 | `/about` 링크 위치 |
| --- | --- | --- | --- | --- | --- |
| `/tools/range` | 히어로 → 도구 → FAQ → 레슨 → 다음 도구, `max-w-[85rem]`(유일한 예외, 아래 설명) | 상세 패널이 DOM에서 매트릭스보다 **앞**. 칸을 고른 동안만 모바일 `sticky top-0`, 데스크톱 `lg:col-start-2 / row-start-2`로 원위치 | `RANGE_FAQ` 4문항(신규 2문항 포함) | 1 → **3** (`poker-range`, `hand-matrix`, `positions-6max`) | FAQ 마지막 문항 "핸드레인지란 무엇인가요?" 답 아래 — `이 표의 출처와 이 사이트의 원칙` |
| `/tools/starting-hand` | 동일 골격, `max-w-shell` | 동일 패턴. 데스크톱 `lg:col-start-2 / row-start-1` | `STARTING_HAND_FAQ` 6문항 | 1 → **3** (`starting-hand-ranking`, `starting-hands`, `hand-matrix`) | FAQ "이 순위는 어떻게 계산했나요?" 답 아래 — `숫자는 어디서 나오나요` |
| `/tools/equity` | 동일 골격, `max-w-shell` (85rem에서 이동) | M8에서 정한 "결과가 입력보다 위" 배치를 **그대로 유지**. 세 줄의 승률을 `ToolAnswer`(ground-800 요철면)로 감싸 강조만 올림 | `EQUITY_FAQ` 4문항 | 1 → **3** (`equity`, `hand-rankings`, `flop-turn-river`) | FAQ "정확 계산이 무슨 뜻인가요?" 답 아래 — `이 사이트가 숫자를 만드는 방식` |
| `/tools/pot-odds` | 동일 골격, `max-w-shell` | 결과 `Panel`을 DOM 최상단으로 이동 + `sticky top-0 z-10 lg:static`, 내부 `max-h-[36svh] overflow-y-auto`. 데스크톱은 `lg:col-start-2 / row-start-1`로 기존 오른쪽 배치 복원 | `POT_ODDS_FAQ` 4문항 | 1 → **3** (`pot-odds`, `outs`, `equity`) | FAQ "이 숫자만 보고 콜하면 되나요?" 답 아래 — `이 사이트가 하는 것과 하지 않는 것` |
| `/tools/outs` | 동일 골격, `max-w-shell` | pot-odds와 동일한 sticky 결과 패턴 | `OUTS_FAQ` 5문항(신규 1문항 포함) | 1 → **3** (`outs`, `pot-odds`, `flop-turn-river`) | FAQ "이 계산기가 대신 해주지 않는 것은 무엇인가요?" 답 아래 — `이 사이트가 하는 것과 하지 않는 것` |
| `/tools/hand-checker` | 동일 골격, `max-w-shell` | M8 배치 유지. 족보 이름을 `ToolAnswer`(size `name`)로 감싸고 "9개 족보 중 N번째" 한 줄을 붙임 | `HAND_CHECKER_FAQ` 5문항(신규 1문항 포함) | 1 → **2** (`hand-rankings`, `flop-turn-river`) | FAQ "이 족보 판정은 무엇이 하나요?" 답 아래 — `숫자는 어디서 나오나요` |

허브 `/tools`는 콘텐츠 역링크 **0 → 6**(출시된 툴마다 1개)이 됐다.

### A. 답이 항상 보인다

두 종류의 문제가 있었고, 둘을 다르게 다뤘다.

- **equity / hand-checker는 이미 고쳐져 있었다.** "결과가 입력보다 위"는 M8에서 의도적으로 내린
  결정이라 DOM을 평탄화하지 않았다. 여기서 한 일은 강조뿐이다.
- **pot-odds / outs는 재발했다.** 375px에서 마지막 필드를 만지면 결과가 접힌 화면 밖으로
  내려갔다. 결과 `Panel`을 DOM 첫 번째로 옮기고 모바일에서만 `sticky top-0 z-10`,
  데스크톱은 `lg:static` + 명시적 `lg:col-start` / `lg:row-start`로 원래의 좌우 배치를 그대로
  복원했다. 스티키 영역이 화면을 잡아먹지 않도록 `max-h-[36svh] overflow-y-auto`를 두고,
  스크롤 가능한 영역이므로 `tabIndex={0}`을 붙여 키보드로도 스크롤된다.
- **range / starting-hand는 테스트가 아니라 실측에서 잡혔다.** 375px에서 첫 칸(AA)을 누르면
  상세 패널의 `top`이 각각 **1154px / 1491px** — 완전히 화면 밖이었다. 상세 패널을 매트릭스보다
  **앞**에 놓고, 칸이 선택된 동안에만 sticky를 켜는 방식으로 고쳤다(선택 전에는 sticky가 아니라
  빈 패널이 화면을 차지하지 않는다). 재측정: 첫 칸 `top: 263`, 마지막 칸 `top: 44`, 두 테마 모두
  `inView: true`. 매트릭스 자체의 608px 스크롤러와 `↔` 큐는 건드리지 않았다.

강조는 새 토큰 없이 WP-2의 표면 의미만으로 했다. `ToolAnswer`는 `bg-ground-800`(움푹 들어간
판독면) + `border-line-500`이고, 숫자는 `tabular text-4xl`, 이름은 `text-3xl`이다.

### B. `/tools/range`의 온워드 링크

목적지는 **시작 핸드 탐색기**다. 이 표가 유발하지만 답할 수 없는 질문이 "왜 하필 이 패들인가"이고,
그 답이 169개 패의 순위이기 때문이다. 같은 13×13 인터페이스라 배울 것이 없고,
`/tools/starting-hand`가 이미 승률 계산기를 가리키므로 고리가 아니라 경로가 된다. 승률 계산기는
상대 핸드 한 개를 요구하는데, 레인지 전체를 보고 있는 독자에게는 아직 그 카드가 없다.
딥링크 파라미터는 붙이지 않았다 — 두 표의 축(포지션 vs 순위)이 달라서 정직한 인계는 기본 뷰다.

### C. 레슨 역링크

`src/features/tools/related.ts`의 `TOOL_LESSON_IDS`가 툴 라우트 id → 레슨 `ContentId` 매핑을
하나로 갖는다. 링크 농장을 만들지 않기 위해, 각 툴에서 실제로 막히는 지점만 골랐다. 예를 들어
pot-odds는 `pot-odds`(개념) / `outs`(비교할 내 확률) / `equity`(그 확률의 이름)이고,
hand-checker는 2개뿐이다 — 세 번째로 붙일 만한 정직한 레슨이 없어서 억지로 채우지 않았다.

6개 파일에 복제돼 있던 `…LessonLink()` 헬퍼는 `ToolLessonLinks` 컴포넌트 하나로 합쳤다.
`contentById` / `hrefOfContent` / `contentMeta` / `KIND_LABEL`을 통해 `LinkCard`를 그리므로
링크 정직성(미출시 → `준비 중`) 규칙은 그대로 흐른다. 목록이 비면 `null`을 반환한다 — 내용 없는
제목을 만들지 않기 위해서다.

허브 `/tools`에는 세 번째 섹션(`aria-label="도구를 이해하는 데 필요한 레슨"`)을 추가해 출시된
툴마다 대표 레슨 카드 하나를 붙였다. 카드의 `meta`에 `${툴 이름} · ${콘텐츠 메타}`를 넣어 어떤
도구의 짝인지 카드 안에서 읽히게 했다.

### D. `/about` 링크

여섯 툴 전부에 **정확히 하나씩**, 계산기 사용자가 실제로 그 질문을 하는 자리에 넣었다. 같은 문장을
6번 찍지 않았고, 툴마다 문구가 다르다(위 표의 마지막 열). 전부 FAQ 항목의 `link` 슬롯을 쓰므로
답변 텍스트 자체는 오염되지 않는다 — 구조화 데이터가 화면과 다른 답을 주장할 수 없다.
`href`는 라우트 레지스트리(`routeById('about')`)를 통해 해결하고, 사용할 수 없으면 `null`이라
링크가 아예 렌더되지 않는다.

### E. Q&A 시스템 통일 ★

**결정: `ExplanationCard` Q&A를 FAQ로 승격하고, 타입화된 배열 하나에서 렌더한다.**

규칙을 한 줄로 정했다:

> **페이지 수준에서 질문 모양을 한 제목은 FAQ 데이터이고 `src/features/tools/faq.ts`에 산다.
> `ExplanationCard`는 질문이 아닌 것 — 계산기 안의 부연, 빈 상태, 오류 상태 — 만 갖는다.**

이유는 세 가지다. (1) 두 시스템이 같은 일을 하고 있었으므로 역할 분리를 문서화하는 쪽은 문제를
이름만 바꾸는 것이다. (2) `seo.spec.ts`가 이미 "선언된 모든 `FAQPage` 질문은 화면에 보이는
`<h3>`여야 한다"를 강제하는데, `FaqSection`이 정확히 그 마크업을 낸다. (3) `FaqItem.answer`가
평문 문자열이라 WP-7이 답을 있는 그대로 발행할 수 있다(FISHTILT_STATE 107).

그 결과 계산기 안에 남은 `ExplanationCard`는 질문이 아닌 것들뿐이다 — 예: `어떻게 계산했나요?`
같은 계산 과정 노출, `그래서 아웃이 몇 장 필요한가요?` 같은 입력값 종속 부연, 빈/오류 상태.
현재 사용 수: range 4, equity 3, pot-odds 3, outs 2, hand-checker 2, starting-hand 0.

**화면에 없는 질문은 데이터에 넣지 않았다.** 배열이 곧 렌더 소스이므로 구조적으로 불가능하다.
**JSON-LD는 만들지 않았다** — WP-7 소관이다.

FAQ 본문은 WP-2의 `max-w-reading`(48rem)로 폭을 제한했다. 72rem에서 한국어 답변이 한 줄
90자에 가까워 읽기 어려웠다. 네 번째 폭이 아니라 `/learn`, `/blog`가 이미 쓰는 세 폭 중 하나다.

### F. 낡은 주석 정정

MASTER가 지목한 2건(`tools/equity/page.tsx:40`, `tools/starting-hand/page.tsx:58`)을 고쳤다.
6개 툴 페이지 + 계산기 컴포넌트 전체를 같은 패턴("아직 안 나왔다", "…까지는 null", "WP-x가
돌면")으로 스윕한 결과 **추가 발견 0건**이었다 — 그 2건이 전부였다. 여섯 페이지의 모듈 주석은
새 페이지 골격(히어로 → 도구 → FAQ → 레슨 → 다음 도구)과 FAQ 데이터의 위치를 명시하도록
다시 썼다.

`/tools/range`의 `max-w-[85rem]`은 남겼고, 대신 주석에 **측정된 이유**를 적었다: 비교 모드는
13×13 매트릭스 두 개를 나란히 놓고 각각 608px(13×44px + 12×3px)이 필요하므로 열 간격까지
1240px가 필요한데 `max-w-shell`(1152px)로는 어떤 뷰포트에서도 모자란다. 1152px에서 두 번째
매트릭스의 마지막 열이 내부 가로 스크롤로 잘리는 것을 스크린샷으로 확인했다. 사이트에서 유일하게
문서화된 예외다.

### G. "이 숫자가 무슨 뜻인가" 한 줄

결과 옆에 의미만 적었다. 판단은 넣지 않았다.

- pot-odds / outs: `ToolAnswer`의 `note` 슬롯
- equity: `각 숫자는 지금 상태에서 남은 카드가 나올 수 있는 모든 경우 중, 그쪽이 차지하는
  비율입니다.` — 일부러 숫자를 포함하지 않아 "퍼센트 모양 노드는 정확히 3개"라는 기존 e2e
  단언과 충돌하지 않는다.
- hand-checker: `9개 족보 중 N번째로 강한 족보입니다.` (N은 평가기가 계산한 값)

`ToolAnswer`의 모듈 주석에 `note`는 의미이지 권유가 아니라는 규칙을 못박았다. 첫 방문 빈 상태도
전부 확인했다 — BB를 고르면 여전히 빈 13×13이 아니라 이유를 적은 설명이 나오고, 그 문장을
`RANGE_FAQ`가 `UNSUPPORTED_REASON_LABEL.BB_HAS_NO_RFI_RANGE`로 **재사용**하므로 화면과 FAQ가
다른 말을 할 수 없다.

## 변경 파일

### 신규 (8)

| 파일 | 역할 |
| --- | --- |
| `apps/fishtilt/src/features/tools/faq.ts` | 여섯 툴의 FAQ 단일 출처. WP-7이 읽을 배열들 |
| `apps/fishtilt/src/features/tools/faq.test.ts` | FAQ 데이터 테스트(도메인 문장 재사용 검증 포함) |
| `apps/fishtilt/src/features/tools/related.ts` | 툴 → 레슨 매핑(`TOOL_LESSON_IDS`, `toolLessonIds`, `primaryToolLessonId`) |
| `apps/fishtilt/src/features/tools/related.test.ts` | 매핑 테스트(모든 id가 실재 콘텐츠인지) |
| `apps/fishtilt/src/components/ToolAnswer.tsx` | 결과 판독면(ground-800) 프리미티브 |
| `apps/fishtilt/src/components/ToolAnswer.test.tsx` | 위 컴포넌트 테스트 |
| `apps/fishtilt/src/components/ToolLessonLinks.tsx` | 툴 페이지의 레슨 역링크 섹션(복제 헬퍼 6개를 대체) |
| `apps/fishtilt/src/components/ToolLessonLinks.test.tsx` | 위 컴포넌트 테스트 |

### 수정 (29)

페이지 (8)

- `apps/fishtilt/src/app/tools/page.tsx`
- `apps/fishtilt/src/app/tools/range/page.tsx`
- `apps/fishtilt/src/app/tools/starting-hand/page.tsx`
- `apps/fishtilt/src/app/tools/equity/page.tsx`
- `apps/fishtilt/src/app/tools/pot-odds/page.tsx`
- `apps/fishtilt/src/app/tools/outs/page.tsx`
- `apps/fishtilt/src/app/tools/hand-checker/page.tsx`
- `apps/fishtilt/src/features/tools/index.ts` (신규 모듈 재수출)

컴포넌트 (7)

- `apps/fishtilt/src/components/RangeExplorer.tsx`
- `apps/fishtilt/src/components/StartingHandExplorer.tsx`
- `apps/fishtilt/src/components/SelectedHandPanel.tsx`
- `apps/fishtilt/src/components/EquityCalculator.tsx`
- `apps/fishtilt/src/components/PotOddsCalculator.tsx`
- `apps/fishtilt/src/components/OutsCalculator.tsx`
- `apps/fishtilt/src/components/HandChecker.tsx`

단위 테스트 (7)

- `apps/fishtilt/src/app/tools/page.test.tsx`
- `apps/fishtilt/src/app/tools/range/page.test.tsx`
- `apps/fishtilt/src/app/tools/starting-hand/page.test.tsx`
- `apps/fishtilt/src/app/tools/equity/page.test.tsx`
- `apps/fishtilt/src/app/tools/pot-odds/page.test.tsx`
- `apps/fishtilt/src/app/tools/outs/page.test.tsx`
- `apps/fishtilt/src/app/tools/hand-checker/page.test.tsx`

E2E (7)

- `apps/fishtilt/tests/e2e/tools-hub.spec.ts`
- `apps/fishtilt/tests/e2e/range-explorer.spec.ts`
- `apps/fishtilt/tests/e2e/starting-hand.spec.ts`
- `apps/fishtilt/tests/e2e/equity.spec.ts`
- `apps/fishtilt/tests/e2e/pot-odds.spec.ts`
- `apps/fishtilt/tests/e2e/outs.spec.ts`
- `apps/fishtilt/tests/e2e/hand-checker.spec.ts`

### 삭제 (0)

없다. 6개 페이지에 복제돼 있던 `…LessonLink()` 헬퍼는 파일이 아니라 각 페이지 안의 지역 함수였고,
`ToolLessonLinks`로 흡수되면서 사라졌다.

## 테스트 / 검증

| 게이트 | 결과 |
| --- | --- |
| `pnpm vitest run --project fishtilt --project learn-core` | **1643 passed** (137 파일). 하한 1600. 이 중 fishtilt만 따로 돌리면 1529 passed (126 파일)이고, WP-4 시작 시점의 fishtilt는 1487이었다 |
| `pnpm typecheck` | 13개 프로젝트 전부 통과, 0 에러 |
| `pnpm lint` | 통과 |
| `pnpm build:fishtilt` | 컴파일 성공, **137/137 프리렌더**, 전 라우트 정적(`○`/`●`), 동적 라우트 0 |
| `pnpm e2e:fishtilt` | **240 passed** (베이스라인 238). 최종 빌드로 서버를 새로 띄운 뒤 재실행해 확인 |
| 375px 실측 (dark + light) | 6개 툴 전부 마지막 입력 직후 답이 **IN VIEW** |

375px 실측 세부(두 테마 동일):

```
range          IN VIEW :: 22
starting-hand  IN VIEW :: 22
equity         IN VIEW :: 82.4%
pot-odds       IN VIEW :: 33.3%
outs           IN VIEW :: 54.1%
hand-checker   IN VIEW :: 에이스와 킹 투페어
```

새로 추가한 회귀 테스트 중 중요한 것:

- `tests/e2e/pot-odds.spec.ts` — 375px에서 필드를 바꾸는 동안 `계산 결과`가 뷰포트 안에 남고,
  스티키 영역이 화면의 60%를 넘지 않는지
- `tests/e2e/outs.spec.ts` — 드로우 프리셋을 고르는 동안 같은 성질
- 페이지 테스트 6개 × 3건 — 모든 FAQ 질문이 보이는 `<h3>`이고 답이 렌더되는지 /
  `/about` 링크가 정확히 1개인지 / `toolLessonIds(...)`의 모든 id를 포함해 서로 다른
  `/learn/*` 역링크가 2개 이상인지
- `src/app/tools/page.test.tsx` — 출시된 모든 툴이 그것을 설명하는 레슨과 짝지어지는지

**기존 단언은 하나도 삭제하거나 약화하지 않았다.** 셀렉터가 깨진 곳은 셀렉터만 고쳤다.

- 허브의 새 레슨 카드 `meta`에 툴 이름이 들어가면서
  `getByRole('link', { name: /팟 오즈 계산기/ })`가 모호해졌다 → 단위 테스트 1개와 e2e 5개를
  `getByRole('region', { name: '지금 사용할 수 있는 도구' })` 안으로 **범위 한정**했다.
  검증하던 성질은 그대로이고 오히려 더 정확해졌다.
- `range-explorer.spec.ts:91`은 FAQ가 BB 설명 문장을 재사용하면서 strict-mode 위반(2개 매치)이
  났다 → 탐색기 자신의 `complementary` 공지로 한정했다. 검증 대상은 동일하다.

## SEO/UX 관점의 영향

- **`FAQPage`가 정직해질 준비가 끝났다.** 여섯 툴 페이지의 질문이 전부 타입화된 배열에서 나오고,
  `FaqSection`이 그것을 보이는 `<h3>` + 평문 답으로 렌더한다. WP-7은 같은 배열을 읽기만 하면
  되고, 화면에 없는 질문을 발행하는 것이 구조적으로 불가능하다. `seo.spec.ts`의 "모든 FAQPage
  질문은 페이지가 실제로 보여주는 질문"은 계속 통과한다.
- **내부 링크 그래프가 굵어졌다.** 툴 → 레슨 역링크 6 → 17개, `/about` 인바운드 0 → 6개,
  허브 → 레슨 0 → 6개, 그리고 플래그십의 막다른 길이 사라졌다(온워드 CTA 0 → 1).
- **답을 먼저 본다.** 계산기의 가치 제안이 스크롤 아래가 아니라 첫 화면에 있다. 모바일에서
  입력을 바꾸는 동안 결과가 붙어 있어 "바꿔 보고 비교한다"는 사용 방식이 실제로 가능해졌다.
- **읽기 폭.** FAQ 산문이 48rem으로 좁아져 한국어 본문의 줄 길이가 정상 범위로 들어왔다.
- **정적성 유지.** 페이지는 전부 서버 컴포넌트 그대로이고 `export const dynamic`을 넣지 않았다.
  137개 프리렌더가 유지된다.
- 전략 조언은 늘어나지 않았다. 새로 쓴 모든 문장은 정의·계산 과정·출처·한계 중 하나이며,
  pot-odds는 여전히 필요 승률만 계산하고 콜/폴드를 말하지 않는다. UI에 "GTO"는 없고,
  레인지 표에는 `학습용 기본 레인지`와 `6인 · 100BB · 아무도 참여하지 않았을 때 (First In)`가
  계속 함께 붙어 있다.

## 남은 이슈

1. **`LinkCard`에 보조 링크 슬롯이 없다.** `LinkCard`가 자기 `<li>`를 직접 렌더하고 카드 전체가
   하나의 `<a>`라서, "툴 카드 안에 레슨 링크"를 넣으면 중첩 `<a>`가 되어 유효하지 않은 마크업이
   된다. 그래서 허브에서는 별도 섹션 + 카드 `meta` 문구로 짝을 표현했다. `LinkCard`는 WP-2
   소유라 손대지 않았다. 카드 하단에 보조 링크 한 줄을 받는 옵셔널 슬롯이 생기면 허브의 이 섹션은
   더 간결해질 수 있다 — **WP-2 후속 판단 사항**.
2. **`/tools/range`의 `max-w-[85rem]`.** 사이트에서 유일하게 WP-2의 세 폭 밖에 있는 컨테이너다.
   측정된 이유(비교 모드 1240px)를 코드 주석에 남겼지만, 토큰으로 승격할지 예외로 둘지는
   디자인 시스템 소유자의 결정이다.
3. **hand-checker의 역링크가 2개다.** 다른 다섯 툴은 3개다. 세 번째로 붙일 정직한 레슨이 없어
   비워뒀다. 족보 관련 레슨이 하나 더 나오면 채울 자리다.
4. **`ExplanationCard`와 `FaqSection`이 여전히 공존한다.** 의도된 역할 분리이고 규칙이
   `faq.ts` 모듈 주석에 적혀 있지만, 툴 외의 표면(레슨·용어집)에는 이 규칙이 아직 적용되지
   않았다. 같은 규칙을 사이트 전체로 넓힐지는 WP-7 이후 판단 사항이다.

## 다음 WP에 넘길 사실 요약

**WP-7(JSON-LD)이 알아야 할 것 — FAQ 데이터의 정확한 위치**

전부 한 파일에 있다: **`apps/fishtilt/src/features/tools/faq.ts`**
(`apps/fishtilt/src/features/tools/index.ts`에서 재수출되므로
`from '../../../features/tools/index.js'`로 임포트하면 된다.)

| 라우트 | export | 문항 수 |
| --- | --- | --- |
| `/tools/equity` | `EQUITY_FAQ` | 4 |
| `/tools/pot-odds` | `POT_ODDS_FAQ` | 4 |
| `/tools/outs` | `OUTS_FAQ` | 5 |
| `/tools/hand-checker` | `HAND_CHECKER_FAQ` | 5 |
| `/tools/range` | `RANGE_FAQ` | 4 |
| `/tools/starting-hand` | `STARTING_HAND_FAQ` | 6 |

섹션 제목은 `TOOL_FAQ_TITLE`(= `자주 묻는 질문`)이며 여섯 페이지가 이 상수를 공유한다.

- 타입은 `FaqEntry`(`src/components/FaqSection.tsx`) = `FaqItem` + 선택적
  `link: { href: string | null; label: string }`.
- **`answer`는 평문 문자열이다.** `FAQPage`의 `acceptedAnswer.text`에 그대로 넣으면 된다.
  마크업이 섞이지 않도록 의도적으로 그렇게 설계했다.
- **`link`는 답변 텍스트의 일부가 아니다.** 구조화 데이터에는 `answer`만 쓰고 `link`는 무시해야
  화면과 발행되는 답이 일치한다(FISHTILT_STATE 107).
- 각 페이지는 이 배열을 `FaqSection`에 그대로 넘긴다. 따라서 배열에 있는 질문은 전부 화면에
  보이는 `<h3>`이고, `tests/e2e/seo.spec.ts`의 "모든 FAQPage 질문은 페이지가 실제로 보여주는
  질문"은 추가 작업 없이 통과한다.
- 일부 답변은 도메인 상수에서 조립된다(예: `RANGE_FAQ`는
  `UNSUPPORTED_REASON_LABEL.BB_HAS_NO_RFI_RANGE`와 `RANGE_PROVENANCE_SENTENCE`를,
  `STARTING_HAND_FAQ`는 `METHODOLOGY_SENTENCE` / `provenanceSentence(HAND_STRENGTH)` 등을
  재사용). **문자열을 하드코딩해 복사하지 말고 배열을 임포트하라** — 데이터셋이 바뀌면 문장도
  같이 바뀐다.
- 이 페이지들은 `WebApplication` JSON-LD를 이미 `SEO` 상수에서 내보내고 있다. `FAQPage`는 그
  옆에 추가하는 형태가 된다.

**다른 WP가 알아야 할 것**

- 툴 → 레슨 매핑은 `apps/fishtilt/src/features/tools/related.ts`의 `TOOL_LESSON_IDS`가
  단일 출처다. 내부 링크 감사(WP-1 계열)를 다시 돌린다면 이 상수를 읽으면 된다.
- 결과 판독면은 `apps/fishtilt/src/components/ToolAnswer.tsx` 하나다. 다른 계산기가 생기면
  이것을 쓰면 강조가 자동으로 일치한다.
- 여섯 툴 페이지의 골격은 **히어로 → 도구 → FAQ → 레슨 → 다음 도구**로 동일하다. 새 툴을
  추가할 때 이 순서를 따르면 된다.
- `/tools/range`만 `max-w-[85rem]`이고 나머지 다섯은 `max-w-shell`이다. 폭 감사 시 예외로
  기대하라 — 이유는 해당 파일 주석에 측정값과 함께 있다.
