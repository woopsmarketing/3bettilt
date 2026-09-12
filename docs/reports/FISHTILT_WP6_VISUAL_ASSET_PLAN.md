# FishTilt WP-6 — 콘텐츠 비주얼 · 이미지 자산 계획

## 목표

Stage-2가 WP-2/3/5에서 실제로 지어 올린 시각 시스템 위에서, **앞으로 어떤 그림을 만들고 어떤
그림은 만들지 않을지**를 실행 가능한 수준으로 확정한다. 특히 다음 네 가지에 결론을 낸다.

1. 131개 페이지가 공유하는 `og.png` 한 장을 페이지별 카드로 바꿀 것인가, 바꾼다면 **어떤
   파이프라인으로 몇 장을**.
2. 15개 레슨 중 **그림이 없으면 설명이 실제로 약한** 것이 무엇인가, 그리고 그 그림이 도메인
   데이터에서 나올 수 있는가.
3. 시각 요소가 **필요 없는** 페이지 유형은 무엇이고 왜인가 — 58개 글로서리를 포함해서.
4. AI 생성 일러스트를 도입할 것인가, 도입한다면 경계는 어디인가.

이 문서는 **문서 하나만** 산출한다. 코드·이미지·스크립트를 만들지 않는다.

## 범위

- **담당**: 시각 자산 계획서 1편.
- **구속 조건**: ruling 100(fishtilt만), 105(날짜 금지), 106·114(실제 이미지가 생기기 전에는
  `ContentRecord`에 이미지 필드 금지), 108(build/e2e 직렬화 — 이 WP는 **아무것도 실행하지
  않았다**), 111(웹폰트 파일 없음, 시스템 폰트 스택), 112(사용자에게 보이는 텍스트를 래스터에
  굽지 않는다), 113(컨테이너 폭은 토큰).
  CLAUDE.md 규칙 2(GTO 수치 조작 금지) · 5(가짜 구현 금지) · 7(포커 규칙을 지어내지 않는다)는
  **그림에도 그대로 적용**한다.
- **범위 밖 — 손대지 않음**: 모든 소스 코드, `public/`, `.next`, 포트 3221, 빌드/e2e/dev 서버.
  읽기와 `grep`만 했다.
- **다른 WP 소관으로 넘기는 것**: `src/lib/seo/**` 배선(WP-7), 최종 시각 리뷰(WP-8),
  실제 컴포넌트 구현(미배정 후속 WP).

## 확인한 기존 상태

| 항목 | 확인한 사실 | 근거 |
|---|---|---|
| `public/` | 파일 **1개** — `og.png`. 실측 **1200×630, 8-bit RGB(colortype 2, 알파 없음), 7,003 bytes** | `ls -la public/`, PNG IHDR 직접 파싱 |
| `og.png` 내용 | 어두운 바탕 + 흰 `FISHTILT` 워드마크 + 브랜드 레드 밑줄 + 13×13 격자(좌상단 삼각형이 브랜드 레드) | 파일을 직접 열어 확인 |
| `<img>` / `next/image` | `src/`·`content/`·`mdx-components.tsx` 전체에서 **0건** | `grep -rnE "<img\|next/image\|<Image[ /]"` |
| 래스터 자산 총계 | `public/og.png`(7,003 B) + `src/app/apple-icon.png`(180×180, 1,542 B). 그 외 0 | `ls -la` |
| 벡터 자산 | `src/app/icon.svg` — 606 bytes, `<rect>` 7개 + `<title>`. 하드코딩 색 3개(`#ff334d`, `#ffffff`, opacity 0.42) | 파일 직접 확인 |
| `next/og` | 이 앱의 `nodenext` 설정에서 `TS2307`. `next/font`·`next/link`도 동일. `next/navigation`은 해석됨 | WP-2 §확인한 기존 상태, `site.ts:76-86` 주석 |
| 래스터 생성 수단 | **있다.** Playwright chromium이 devDependency(`@playwright/test ^1.62.1`)로 설치돼 있고, WP-2b가 `icon.svg`를 180×180으로 렌더해 `apple-icon.png`를 실제로 만들었다 | WP-2 보고서 §3 "apple-icon.png — 생성 성공" |
| 한국어 웹폰트 | 저장소에 폰트 파일 0개. `--font-sans`는 시스템 스택(`Apple SD Gothic Neo`, `Malgun Gothic` 명시) | ruling 111, WP-2 §1 |
| 콘텐츠 | MDX 113편 = learn **15** · blog **20** · glossary **58** · hands **20** | `find content -name '*.mdx'` |
| 페이지 | 131 = 정적 라우트 18 + 콘텐츠 113. 사이트맵 130 URL. 프리렌더 엔트리 137(메타데이터 라우트 포함) | FISHTILT_STATE, WP-5 §테스트 |
| `ContentRecord` | 날짜 필드 0, 이미지 필드 0 (ruling 105/114) | `src/content/types.ts` 직접 확인 |
| `topic` × `kind` | 8 × 4 = 32 조합, 둘 다 닫힌 유니온 | `src/content/types.ts:CONTENT_TOPICS / CONTENT_KINDS` |
| 컨테이너 폭 리터럴 | `max-w-[42rem]`이 **아직 4개 라우트에 남아 있다** — `learn/[slug]`, `glossary/[slug]`, `hands/[hand]`, `about`. WP-5가 고친 것은 `blog/[slug]` 하나뿐 | `grep -rn "max-w-\[42rem\]" src/` |
| OG 배선 | `metadata.ts`의 `OG_IMAGE` 상수 1개를 `pageMetadata`가 **모든 페이지에** 그대로 붙인다. `contentMetadata`도 이 경로를 탄다 | `src/lib/seo/metadata.ts:61-97` |

## 구현 내용

> 이 절의 9개 소절이 계획 본문이다. **코드 변경은 없다.**

---

### 1. 지금 무엇이 이미 있는가

Stage-2가 실제로 만든/이미 쓰이고 있는 시각 자산 전부. 계획은 여기서 시작한다.

| 컴포넌트 · 자산 | 무엇을 그리는가 | 데이터 출처 | DOM 노드 수 | 어디에 쓰이는가 |
|---|---|---|---|---|
| `ContentThumbnail` (WP-5) | topic 8종 선화 + kind 4종 강조색. 인라인 SVG | **없음(결정적 생성)** — `record.topic` → 그림, `record.kind` → 색. 난수·해시·레코드별 데이터 0 | **7~12** (실측, 래퍼 포함). `range`가 12로 최대, `odds`/`equity`가 7로 최소. hero는 +1 | `/blog` 목록 카드 20장, `/blog/[slug]` 상단 hero 1장 = **21곳** |
| `HomeHeroVisual` (WP-3) | 실제 카드 2장(`AKs`) + 실제 13×13 표 축소판(`BTN` RFI 레인지) + 3색 범례 + 조건 줄 | `strategy-core` `HAND_CLASSES`(169) · `resolveRange({BTN,RFI,100BB,6인})` · `learn-core` `handClassFacts` · `features/range/copy.ts` | 표 격자만 **169** `<span>` (WP-5가 썸네일 20장 175노드와 비교한 실측치). 컴포넌트 총계는 `미확인` | 홈 히어로 1곳(`src/app/page.tsx:366`) |
| `HomeRangePreview` (MVP) | 인터랙티브 13×13 + 자리 버튼 6개 + `aria-live` 요약 | `resolveRange` (클라이언트 상태) | `RangeMatrix` 169 `<button>` + 자리 버튼 6 + 범례. 총계 `미확인` | 홈 §4(`page.tsx:449`) |
| `RangeMatrix` (MVP) | 진짜 13×13 차트. 44px 셀, 169 `<button>`, 가로 스크롤러, 클라이언트 컴포넌트 | `resolveRange` / `handClassAt` | **169 `<button>`** + 래퍼 | `/tools/range`, `/hands/[hand]`(`selectedKey`), `RangeMatrixMini`, `HomeRangePreview` |
| `RangeMatrixMini` (MVP) | `RangeMatrix` + `RangeSummary` + `SelectedHandPanel` + 자리 토글의 합성. 본문 삽입용 | 동일 | `RangeMatrix` 상속 | **MDX 10편** |
| `PokerCards` / `PokerCard` (MVP) | 진짜 카드. **DOM 텍스트 + 유니코드 무늬 글리프**(`♠♥♦♣`), 래스터·SVG 아님 | `learn-core` `handClassFacts` 대표 콤보 또는 `shared` `parseCards` | 카드 1장당 **3 `<span>`**(계산: 래퍼 + 랭크 + 무늬) | **MDX 53편** + `/hands/[hand]` + 퀴즈(`QuizVisualView`) + 홈 히어로 |
| `QuizVisualView` (MVP) | 문제·보기의 카드. `PokerCards`로 위임하는 얇은 디스패치 | `features/quiz/types.ts`의 `QuizVisual` | `PokerCards` 상속 | `QuizQuestionCard` (문제 1 + 보기별 1) |
| `PositionLegend` (WP-Q) | `UTG=언더더건` 식 약어 해설. 텍스트, `aria-hidden` | `features/range` `positionLegendEntry` | 텍스트 목록 | `RangeFilters` · `RangeMatrixMini` · `RangeExplorer` · `HomeRangePreview` |
| `Figure` (WP-5) | `<figure>` + `<figcaption>`. **표면을 그리지 않는다** | 캡션은 **프롭**(자식 아님) → `measureContent`가 세지 않음 → `readMinutes` 불변 | 2 (figure + figcaption) | **MDX 3편** (`outs-nine`, `pot-odds-quick`, `why-use-range`) |
| `OutsFigure` (WP-5) | 아직 안 보이는 카드 전부를 정사각형으로, 아웃츠만 채움. 확률은 **한 글자도 안 찍는다** | `learn-core` `outsOdds`의 `unseenCards`(플랍 47 / 턴 46) | `unseenCards`개 `<rect>` + 약 10 = **약 57** (`outs=9,FLOP` 기준 **계산**, 실측 아님) | `/blog/outs-nine` 1곳 |
| `PotOddsFigure` (WP-5) | 최종 팟 막대를 `원래 팟 / 상대 베팅 / 내 콜`로 자르고 콜만 강조. 퍼센트 미출력 | `shared` `Money.parseBB`·`Money.ratio` + `learn-core` `potOdds`. **이 파일에 BB 산술 0건** | 약 **15** (계산) | `/blog/pot-odds-quick` 1곳 |
| `icon.svg` (WP-2) | 브랜드 라운드 스퀘어 + 흰 대각 3칸 + 흐린 상삼각 3칸 (13×13 모티프의 축약) | 손으로 작성. 색 3개 하드코딩 | SVG 요소 **7** | 브라우저 탭 파비콘 (Next app-dir 파일 컨벤션) |
| `apple-icon.png` (WP-2b) | 같은 문양, `rx=0` 풀블리드, 알파 없음 | `icon.svg`를 **Playwright chromium 180×180 뷰포트 렌더** | — (래스터) | iOS 홈 화면 |
| `og.png` (WP-N) | `FISHTILT` 워드마크 + 브랜드 레드 밑줄 + 13×13 격자 | 손으로 작성 | — (래스터) | **131 페이지 전부**가 공유하는 `og:image` / `twitter:image` |

**여기서 읽어야 할 세 가지 사실**

1. **이 사이트의 그림은 전부 "사이트의 실제 물건"이거나 그 물건에서 파생된 것이다.** 스톡
   일러스트도, 아이콘 폰트도, 장식용 벡터 팩도 하나도 없다. 이건 우연이 아니라 WP-3이
   `HomeHeroVisual`에서 명시적으로 정한 노선이고 WP-5가 카드 규모로 따라간 것이다.
2. **"이미지가 0개"라는 말은 절반만 맞다.** 래스터 파일이 0에 가까운 것이지, **시각 요소는
   이미 상당히 촘촘하다** — MDX 113편 중 53편에 진짜 카드가, 10편에 진짜 13×13 표가 들어 있다.
   비어 있는 것은 "그림"이 아니라 **캡션 있는 설명 도해**다.
3. **비어 있는 자리는 세 곳뿐이다**: (a) 레슨 본문의 개념 다이어그램, (b) 페이지별 OG 카드,
   (c) 블로그 17편의 본문 그림. §3이 이 셋을 우선순위로 정리한다.

---

### 2. 페이지 유형별 비주얼 가이드

각 유형에 대해 **필요/불필요**를 먼저 판정하고, 필요한 것만 규격을 적는다.

#### 2-1. 홈 히어로 — **필요, 이미 충족. 추가 금지**

- 판정: `HomeHeroVisual`이 이미 있고, WP-3이 남긴 지시가 명확하다 — **"이미지로 교체하지 마라."**
  ruling 112가 요구하는 라이브 텍스트 형태를 이미 만족하고 클라이언트 JS가 0바이트다.
- 종류: **데이터 그림**(실제 레인지 + 실제 대표 콤보).
- 규격: 13열 CSS grid, `max-w-[20rem]`, 셀은 `aspect-square`. 169 `<span>`. 애니메이션 0,
  `transition` 0.
- 라이트/다크: 성립. 색은 전부 역할 토큰이고, 표시 셀은 `brand-600` 채움 + `ink-on-brand`
  `border-2`(다크 5.09:1 / 라이트 8.08:1)로 색약 독자도 찾을 수 있다.
- **금지**: 히어로에 `role="group"`을 붙이지 말 것(`responsive-a11y.spec.ts`가 `/`에서
  `role="group"`으로 13×13과 자리 버튼을 찾는다). 히어로의 `a.bg-brand-600` 첫 번째를
  `theme-and-header.spec.ts`가 hover 대비 측정에 쓴다 — 채움 버튼을 없애면 그 테스트가 다른
  것을 잡는다.

#### 2-2. 툴 페이지 6종 — **시각 요소 불필요 (신규 장식 금지)**

- 판정: **불필요.** 근거 셋.
  1. **도구 자체가 시각 요소다.** `/tools/range`는 13×13 차트, `/tools/outs`는 `OutsCalculator`,
     `/tools/pot-odds`는 `PotOddsCalculator`, `/tools/equity`는 `EquityCalculator`,
     `/tools/hand-checker`는 카드 그리드, `/tools/starting-hand`는 탐색기다. 화면의 주인공이
     이미 그림이다.
  2. WP-4가 여섯 페이지를 `히어로 → 도구 → FAQ → 레슨 → 다음 도구`로 통일했다. 히어로에 장식
     그림을 넣으면 **도구가 첫 화면 밖으로 내려간다** — WP-4가 모바일에서 패널이 1154px/1491px에
     떨어져 있던 것을 고친 직후다.
  3. 툴은 `ContentRecord`가 아니라 `RouteEntry`다. `kind`도 `topic`도 없어서 `ContentThumbnail`을
     그대로 붙일 수 없고, 붙이려면 라우트→토픽 매핑이라는 두 번째 분류 체계가 생긴다.
- 예외 후보: `/tools` 허브의 6개 `LinkCard`. `visual` 슬롯이 비어 있다. **그래도 켜지 말 것** —
  위 3번의 매핑 비용을 6장의 카드가 정당화하지 못한다. OG 카드(§4)는 라우트→토픽 매핑을
  32장 중 이미 존재하는 그림으로 해결하므로 별개 문제다.

#### 2-3. 블로그 목록 카드 — **필요, 이미 충족**

- 판정: **필요하고 이미 있다.** 20/20 카드에 `ContentThumbnail`.
- 종류: **브랜드 + 개념 힌트**(장식이지만 주제를 식별시킨다).
- 규격: **16:5**, viewBox `0 0 160 50`, `rounded-md`, `bg-ground-800` 우물 + `border-line-500`.
  **≤40노드**가 단위 테스트와 e2e 양쪽에 박혀 있고 실측 7~12.
- 라이트/다크: 성립(전부 `currentColor` + `text-*` 토큰, 하드코딩 색 0건).
- 남은 조정은 WP-8 소관(칩/그룹 헤딩 중복, 1편짜리 그룹의 빈 칸 — WP-5 §남은 이슈 1·2).

#### 2-4. 블로그 상세 — **필요, 상단은 충족. 본문은 부분 공백**

- 상단 hero: **충족**. 24:5, viewBox `0 0 240 50`, 같은 그림을 x+40 이동해 중앙 정렬.
- 본문: **20편 중 3편만** `Figure`를 가진다. 나머지 17편 중 그림이 실제로 설명을 개선하는 것만
  §3에서 고른다. **17편 전부에 넣는 것은 명시적으로 반대한다** — WP-5가 `why-called-3bet`에
  넣지 않은 이유(금액을 지어내야 함)가 정확히 그 이유다.
- 규격: `Figure`는 `my-8`(= `Callout` 리듬), 캡션은 `text-sm text-text-300`(`text-500`은 본문
  금지). 도해는 자기 표면(`ground-800` + `border-line-500`)을 갖고 `Figure`는 프레임을 그리지
  않는다.

#### 2-5. 학습 레슨 15편 — **필요. 여기가 가장 큰 공백이다**

- 판정: **필요.** 15편에 캡션 있는 `Figure`가 **0편**이다. `PokerCards`·`RangeMatrixMini`는
  들어가 있지만, 그건 "이 핸드는 이렇게 생겼다"이지 **"이 개념은 이렇게 작동한다"가 아니다.**
- 종류: **개념 다이어그램**(일부는 데이터 그림). 장식 아님.
- 규격: `Figure` 안, 자체 표면 `rounded-lg border-line-500 bg-ground-800 p-4 sm:p-5`,
  가로 `max-w-[22rem]`~전폭, **라벨은 SVG `<text>` 또는 SVG 밖 DOM**(래스터 0).
  노드 예산: 본문 도해는 페이지당 1~2개뿐이므로 썸네일의 40노드 예산이 적용되지 않는다
  (`OutsFigure`가 약 57노드로 이미 그 선례다). 상한은 **200노드**를 권고한다.
- 라이트/다크: `currentColor` + 토큰만 쓰면 자동 성립. 채움끼리의 대비는 **계산해서** 확인할 것
  (WP-2 규약: 스크린샷 아님).
- 목록과 근거는 §3-2.

#### 2-6. 글로서리 58편 — **시각 요소 불필요. 이건 정당한 결론이다**

- 판정: **불필요.** 근거 넷.
  1. **반복이 그림을 벽지로 만든다.** 58개 항목을 8개 토픽에 나누면 같은 그림이 **평균 7.25번**
     반복된다. WP-5가 `/learn` 허브 썸네일을 켜지 말라고 한 두 번째 근거가 정확히 이것이고,
     글로서리는 그 문제가 `/learn`(15편)보다 **네 배** 심하다.
  2. **용어 페이지의 목적은 "빠르게 확인하고 원래 읽던 곳으로 돌아가기"다.** 독자는 대개
     `<Term>` 팝오버에서 왔거나 본문 링크에서 왔다. 그림은 스크롤을 늘려서 그 왕복을 느리게 한다.
  3. **정의 자체가 그림보다 짧다.** 한 항목은 `shortDefinition` 한 줄 + 200~400자 정의다.
     `OutsFigure` 크기의 도해를 붙이면 **그림이 본문보다 크다.**
  4. **필요한 곳에는 이미 붙어 있다.** 카드가 필요한 용어에는 `PokerCards`가, 레인지가 필요한
     용어에는 `RangeMatrixMini`가 이미 들어갈 수 있다(MDX 허용 목록에 있다). 새 시스템이 필요한
     게 아니라 개별 항목의 저술 판단이다.
- **예외 — 열거형 용어 소수에만**: `족보`(9종), `무늬`(4종)처럼 **닫힌 집합을 나열하는 것이
  정의 그 자체**인 항목. 이때도 새 컴포넌트를 만들지 말고 §3-2가 만드는 레슨 도해를 재사용한다.
  대상은 많아야 3~5개이고, 각 항목의 저자가 판단할 일이지 일괄 적용 대상이 아니다.

#### 2-7. 핸드 페이지 20편 — **시각 요소 불필요 (이미 최대 밀도)**

- 판정: **불필요.** 이미 `PokerCards size="lg"`(그 클래스의 대표 콤보) + `RangeMatrix
  selectedKey`(그 칸이 표시된 진짜 13×13)를 갖고 있다. ruling 17이 `RangeMatrixMini`에
  하이라이트 프롭을 추가하는 대신 `RangeMatrix`의 기존 기능을 쓰라고 이미 정했다.
- 허브 `/hands`도 썸네일 **불필요**: 카드가 `handKey`(`AKs`)를 달고 있고, 독자가 그 목록에서
  찾는 신호는 핸드 키다. 20장이 8종 그림을 돌려 쓰면 §2-6과 같은 벽지가 된다.

#### 2-8. 퀴즈 4개 (`/practice` + 3) — **시각 요소 불필요 (이미 충족)**

- 판정: **불필요.** `QuizQuestionCard`가 문제와 보기 양쪽에 `QuizVisualView` → `PokerCards`를
  이미 그린다. 레인지 퀴즈는 `RangeMatrix`를 쓴다.
- **추가 금지 항목**: 정답/오답 피드백에 아이콘·일러스트를 넣지 말 것. 정답 표시는 이미
  `act-call-500`이 담당하고(WP-2가 상태색 토큰을 추가하지 않은 이유), 아이콘을 넣으면 색만으로
  전달하지 않기 위해 텍스트를 또 넣어야 해서 셋이 같은 말을 한다.

#### 2-9. 허브 5개 (`/learn` `/tools` `/practice` `/glossary` `/hands`) — **시각 요소 불필요**

- 판정: **불필요.** WP-5의 `/learn` 권고를 5개 허브 전체로 확장한다. 근거는 동일하고 강해진다.
  - `/learn`: 카드가 `eyebrow`로 `01`…`15`를 달고 있다. 독자가 찾는 신호는 **순서**이고, 그림은
    순서와 같은 자리에서 경쟁한다. 15편의 topic 분포가 좁아 같은 그림이 연달아 나온다.
  - `/glossary`(58) · `/hands`(20): §2-6 · §2-7.
  - `/tools`(6) · `/practice`(4): `ContentRecord`가 아니라 `topic`이 없다(§2-2).
- **켜는 비용은 0이다**(호출부 한 줄). 그래서 지금 미루는 것도 비용이 0이고, WP-8이 실물을 보고
  판단하는 편이 낫다. 이 문서의 권고는 **켜지 않는 쪽**이다.

#### 요약 표

| 페이지 유형 | 판정 | 종류 | 규격 | 라이트/다크 |
|---|---|---|---|---|
| 홈 히어로 | 충족·추가 금지 | 데이터 그림 | 13열 grid, 169 span, `max-w-[20rem]` | 성립(계산 검증됨) |
| 툴 6종 | **불필요** | — | — | — |
| 블로그 목록 카드 | 충족 | 브랜드+개념 힌트 | 16:5, ≤40노드(실측 7~12) | 성립 |
| 블로그 상세 상단 | 충족 | 브랜드+개념 힌트 | 24:5, viewBox 240×50 | 성립 |
| 블로그 상세 본문 | 부분 공백(3/20) | 데이터 그림 | `Figure` + 자체 표면, ≤200노드 | 성립 |
| **학습 레슨 본문** | **공백(0/15)** | 개념 다이어그램 | `Figure` + 자체 표면, ≤200노드, 라벨은 `<text>`/DOM | 토큰만 쓰면 성립 |
| 글로서리 58 | **불필요** | (예외 3~5건만) | — | — |
| 핸드 20 | **불필요** | — | — | — |
| 퀴즈 4 | **불필요** | — | — | — |
| 허브 5 | **불필요** | — | — | — |
| **OG 카드** | **공백(1장 공유)** | 브랜드 | 1200×630 PNG, 다크 고정 | 다크 고정(테마 없음) |

---

### 3. 실제로 필요한 이미지 목록, 우선순위 순

판정 기준은 하나다 — **이 그림이 없으면 독자가 무엇을 이해하지 못하는가.** 한 줄로 답하지
못하면 목록에서 뺐다.

#### 3-1. 우선순위 표

| # | 자산 | 없으면 독자가 이해 못 하는 것 | 데이터 출처 | 신규 코드 |
|---|---|---|---|---|
| 1 | `/learn/outs`에 `OutsFigure` 투입 | "아웃츠 9장"의 9가 **무엇에 대한 9인지**. 분모(플랍 47장)를 본 적이 없다 | `learn-core` `outsOdds.unseenCards` | **0** (MDX 한 줄) |
| 2 | `/learn/pot-odds`에 `PotOddsFigure` 투입 | 팟오즈의 **분모가 콜한 뒤의 팟**이라는 것. 초보가 틀리는 지점이 나눗셈이 아니라 분모다 | `shared` `Money` + `learn-core` `potOdds` | **0** (MDX 한 줄) |
| 3 | `PositionSeatMap` → `/learn/positions-6max`, `/learn/position` | 여섯 자리가 **테이블에서 어디에 있고 누가 먼저 행동하는지**. 지금은 산문과 `PositionLegend` 텍스트 목록뿐이라, 자리가 "이름 여섯 개"로만 읽힌다 | `strategy-core` `StrategyPosition` 순서 + `features/range` `POSITION_LABEL` / `positionAccessibleName` | 신규 1 |
| 4 | `HandMatrixAxesFigure` → `/learn/hand-matrix` | 13×13 표의 **축이 랭크×랭크**라서 대각선이 페어이고 위가 수티드·아래가 오프수트라는 것. 이 사이트의 핵심 오브젝트를 가르치는 레슨인데 축 설명 그림이 없다 | `strategy-core` `HAND_CLASSES` / `handClassAt` (라벨도 데이터에서) | 신규 1 |
| 5 | **OG 카드 32장** (§4) | 공유·검색 결과에서 **이 링크가 무엇에 관한 것인지**. 131페이지가 전부 같은 카드다 | `CONTENT_KINDS` × `CONTENT_TOPICS` + 기존 8종 그림 | 생성 스크립트 1 |
| 6 | `CategoryFrequencyFigure` → `/learn/poker-hand-rankings`, `/blog` 족보 글 | 족보 순서가 **왜 그 순서인지**. "드물수록 강하다"를 말로만 하면 순서를 외우게 되지 이해하게 되지 않는다 | `learn-core` `categoryFrequency` — `C(52,5)=2,598,960` 전수 계산 (WP-G3a) | 신규 1 |
| 7 | `StreetSequenceFigure` → `/learn/flop-turn-river`, `/learn/holdem-basics` | 한 판이 **네 번의 베팅 라운드**로 나뉘고 그 사이에 3·1·1장이 열린다는 진행 구조 | 카드 장수는 **규칙**(전략 아님). 상수로 고정하고 손으로 타이핑하지 말 것 | 신규 1 |
| 8 | `EquityShareFigure` → `/learn/equity` | 승률이 **하나의 팟을 나눠 갖는 지분**이라는 것. 지금 `/learn/equity`는 백분율을 문장으로만 말한다 | `learn-core` `exactHeadsUpEquity` bps 또는 동결된 `classVsClassMatchupFor`(QQ vs AKs 24 / AKo 72 페어링) | 신규 1 |
| 9 | `ActionChoiceFigure` → `/learn/poker-actions` | **다섯** 행동이 "낼 돈이 남아 있는가"에 따라 갈린다는 것. ruling 12가 이 레슨의 설명이 "네 가지뿐"이라고 잘못 적혀 있던 것을 고쳤을 만큼 혼동이 실재한다 | 규칙(체크·베팅·콜·레이즈·폴드). **금액 없음** | 신규 1 |
| 10 | `BetCountFigure` → `/learn/three-bet`, `/blog/why-called-3bet` | 왜 첫 재레이즈가 **3**-Bet인지. ADR-0081이 "빅블라인드 강제 포스트가 1번째 베팅"이라고 이미 확정했는데 그림이 없다 | **ADR-0081**. 순번만 그리고 **금액은 그리지 않는다** — WP-5가 이 글에 그림을 넣지 못한 이유가 정확히 금액이었고, 순번만 그리면 그 문제가 사라진다 | 신규 1 |

**11번 이하는 만들지 않는다.** 검토했다가 뺀 것과 이유:

- `/learn/starting-hands` 조합 수 도해(1,326 콤보 / 169 클래스) — `HAND_CLASSES.length`와
  6/4/12 콤보는 진짜 데이터지만, 이 레슨은 **이미** `PokerCards` + `RangeMatrixMini`를 갖고
  있고 4번(`HandMatrixAxesFigure`)이 같은 것을 더 잘 가르친다. **중복.**
- `/learn/starting-hand-ranking` 상위 X% 중첩 도해 — 데이터는 있다(WP-R 강도 데이터셋). 하지만
  이 페이지는 이미 `/tools/starting-hand` 탐색기로 보내고 있고, 그림이 **강도 주장**을 정적으로
  고정하는 순간 탐색기가 보여주는 조건부 사실보다 약해진다. **뺀다.**
- `/learn/preflop` 블라인드→액션 순서 — 3번과 10번이 각각 절반씩 이미 담당한다. **중복.**
- `/learn/poker-range` 레인지 정의 도해 — `RangeMatrixMini`가 이미 이 레슨에 들어갈 수 있고
  10편의 MDX가 이미 쓰고 있다. **두 번째 시스템 금지.**
- 글로서리 58편 개별 그림 — §2-6.
- 블로그 17편 일괄 그림 — 위 6~10번이 만들어지면 그중 몇 편은 **같은 컴포넌트를 재사용**해서
  자연히 채워진다(`why-blinds-exist`는 7번, `why-called-3bet`은 10번). 나머지는 넣지 않는다.

#### 3-2. "도메인 데이터에서 나오는가" 판정

이 구분이 중요한 이유: 데이터에서 나오는 그림은 **틀릴 수 없고**, 설명 도해는 **틀릴 수 있다.**
후자는 CLAUDE.md 규칙 7이 적용된다 — 확신이 없으면 지어내지 말고 `docs/DECISIONS.md`에
가정을 적고 UI에 수동 오버라이드를 노출하라.

| # | 자산 | 분류 | 규율 |
|---|---|---|---|
| 1·2 | `OutsFigure` · `PotOddsFigure` | **도메인 데이터** | 이미 구현됨. 불가능한 입력은 그럴듯한 그림 대신 throw → 프리렌더라 빌드 실패 |
| 3 | `PositionSeatMap` | **도메인 데이터**(자리 이름·순서) + 설명 도해(좌석 배치 기하) | 자리 이름과 순서는 `strategy-core`에서. 원형 배치는 표현이지 주장이 아니다 |
| 4 | `HandMatrixAxesFigure` | **도메인 데이터** | 축 라벨은 `HAND_CLASSES` 키에서 조립. **채워진 레인지를 그리지 마라** — 조건 문구 없이 레인지를 그리면 보편 조언으로 읽힌다(WP-3 지시) |
| 5 | OG 카드 | 생성 자산 | 기존 8종 그림 재사용 |
| 6 | `CategoryFrequencyFigure` | **도메인 데이터, 전수 계산** | 막대 길이는 `categoryFrequency` 그대로. 이 사이트가 만들 수 있는 **가장 강한 그림**이다 |
| 7 | `StreetSequenceFigure` | **설명 도해**(규칙) | 3/1/1/5/7은 홀덤 규칙이지 전략이 아니다. 그래도 **상수로 두고 손으로 타이핑하지 마라** |
| 8 | `EquityShareFigure` | **도메인 데이터** | 승/무/패 bps. `heroWinBps + tieBps + villainWinBps === 10000`이 이미 보장된다 |
| 9 | `ActionChoiceFigure` | **설명 도해**(규칙) | 다섯 행동은 규칙. **금액을 그리지 마라** |
| 10 | `BetCountFigure` | **설명 도해**(ADR-0081) | 순번만. **금액을 그리는 순간 CLAUDE.md 규칙 2 위반이다** |

#### 3-3. 모든 신규 도해가 지켜야 할 공통 규율

1. **자체 표면을 갖는다** (`rounded-lg border border-line-500 bg-ground-800 p-4 sm:p-5`).
   `Figure`는 마크업과 캡션만이다 — 상자 안의 상자 금지.
2. **같은 수치를 두 번 찍지 않는다.** 본문 `<Fact>`가 이미 말한 숫자를 그림이 자기 반올림으로
   다시 찍으면 한 페이지에 숫자 두 개가 생긴다. `OutsFigure`/`PotOddsFigure`가 확률·퍼센트를
   출력하지 않는 이유다.
3. **말로도 진술한다.** 그림 아래 범례가 모든 값을 텍스트로 반복 → 색만으로 전달하지 않기
   (WCAG 1.4.1) + 그림이 `aria-hidden`이 될 자격을 얻는다(§6).
4. **캡션은 `Figure`의 프롭**이지 자식이 아니다. `measureContent`가 세지 않으므로 발행된 글에
   그림을 넣어도 `readMinutes`와 900자 색인 하한이 안 흔들린다 → 레지스트리 레코드 변경 0.
5. **서버 컴포넌트, 클라이언트 JS 0바이트.** 인터랙션이 필요하면 그건 도해가 아니라 도구다.
6. **불가능한 입력은 throw.** 프리렌더라 빌드 실패가 되고, 그게 가짜 그림보다 낫다.

---

### 4. OG 이미지 — 이 문서의 가장 중요한 미해결 문제

#### 4-0. 먼저 확정해야 할 사실 하나

**주요 소셜 서피스는 전부 이미지 옆에 `og:title`을 텍스트로 렌더한다.**
Twitter/X `summary_large_image`, Facebook, Slack, Discord, 그리고 한국어 독자에게 가장 중요한
카카오톡 링크 미리보기 — 전부 `이미지 + 제목 텍스트 + 설명 텍스트` 구조다. 즉:

> **카드에 제목을 굽는 것은 이미 텍스트로 전송되고 있는 것을 픽셀로 한 번 더 보내는 일이다.**

페이지별 OG 카드가 실제로 벌어들이는 것은 **제목의 가독성이 아니라 주제 식별**이다 — 피드에서
"이건 레인지 얘기구나 / 이건 확률 얘기구나"가 0.2초에 읽히는 것. 그 정보는 **`topic` 하나로
충분**하고, `topic`은 이미 8종 그림을 갖고 있다.

이 사실이 아래 권고 전체를 결정한다.

#### 4-1. 권고안 A — `kind × topic` 32장. **이것을 권고한다**

**무엇을 굽는가**

- 1200×630 PNG, **다크 고정**(`@theme` 기본값이 곧 사이트 정체성. 기존 `og.png`도 다크).
- 구성: `ground-900` 바탕 + 좌하단 `FISHTILT` 워드마크 + 브랜드 레드 밑줄 +
  **§1의 topic 8종 선화를 큰 스케일로**, kind 4종 강조색.
- **사용자에게 보이는 지역화 대상 텍스트 0자.** 유일한 글자는 `FISHTILT` 워드마크인데, 이건
  **브랜드 이름이라 번역 대상이 아니다** — `SITE_NAME`이 라틴 문자열로 고정돼 있고
  `SiteHeader`/`SiteFooter`가 렌더하는 그 워드마크다. 기존 `og.png`도 정확히 이걸 하고 있다.
- 파일 수: **32**(8 topic × 4 kind). 허브·툴·퀴즈·`/about`·`/search` 등 `topic`이 없는 정적
  라우트 18개는 **기존 `og.png`를 그대로 쓴다** — 폴백이 곧 브랜드 카드다.

**ruling 112와의 관계**: 충돌 없음. 오히려 이 방향이 ruling 112의 목적(유지보수 비용)을 가장
직접적으로 달성한다 — **로케일이 늘어도 재생성할 파일이 0장**이다. 32장은 로케일과 무관하다.

**파이프라인 (설계, 구현 아님)**

```
[1] 팔레트          scripts/og/palette.ts
                    카드가 쓰는 6~8개 hex를 상수로 보유.
                    theme-tokens.test.ts와 같은 방식으로 globals.css의 @theme 값과
                    일치하는지 단위 테스트가 검증 → 토큰 드리프트 불가능.

[2] 그림 원본       src/components/contentArt.ts   (ContentThumbnail에서 추출)
                    topic 8종의 SVG 바디를 currentColor로 반환하는 순수 데이터 모듈.
                    ContentThumbnail은 Tailwind 클래스로, OG 생성기는 명시 color로 색을 준다.
                    → 그림이 한 벌만 존재한다(두 번째 시스템 금지).

[3] 템플릿          scripts/og/template.ts
                    (kind, topic) → 완결된 HTML 문자열. 외부 요청 0, 폰트 파일 0
                    (워드마크는 시스템 폰트 스택 그대로).

[4] 렌더            scripts/og/generate.spec.ts   +   playwright.og.config.ts
                    chromium 1회 기동 → 브라우저 컨텍스트 재사용
                    → 32회 { setContent(html); screenshot(1200x630) }
                    → public/og/<kind>-<topic>.png

[5] 실행            pnpm og:fishtilt
                    = playwright test --config=playwright.og.config.ts
                    e2e 설정과 별개 config → pnpm e2e:fishtilt가 이걸 실행하지 않는다.
                    ruling 108(포트 3221·.next 직렬화)에 걸리지 않는다 —
                    이 스크립트는 dev/prod 서버를 띄우지 않는다.

[6] 배선            src/lib/seo/site.ts + metadata.ts        ← WP-7 소관
                    ogImageFor(record) → `/og/${record.kind}-${record.topic}.png`
                    ogImageFor(없음)   → OG_IMAGE_PATH (= '/og.png')

[7] 보증            src/lib/seo/site.test.ts
                    CONTENT_KINDS × CONTENT_TOPICS 32조합 전부에 대해
                    public/og/<...>.png가 디스크에 실제로 존재함을 검사.
                    content.test.ts가 PUBLISHED 레코드의 MDX를 검사하는 그 패턴.
```

**왜 `next/og`가 아닌가**: `TS2307`. ruling 111 문단과 `site.ts:76-86` 주석이 같은 실패를
기록한다. 확인만 하고 뒤집지 않는다.

**왜 실제 페이지를 스크린샷하지 않는가**: 카드 조합마다 정적 라우트가 필요해져 **131페이지
카운트가 흔들리고**, 쿼리 파라미터로 하면 동적 렌더가 필요해 "`export const dynamic` 0건"을
깬다. 독립 HTML 템플릿은 서버가 필요 없고 페이지 수를 건드리지 않는다.

**왜 `tsx` 같은 새 의존성을 안 쓰는가**: Playwright가 이미 devDependency이고 **자체 TS
트랜스파일러를 갖고 있다.** 별도 config의 testDir로 지정하면 새 의존성 0개로 TS 생성기를 돌릴 수
있다.

**빌드 시간 · 저장소 크기 추정 (근거 명시)**

*크기* — 실측 앵커: `og.png`는 **1200×630, 8-bit RGB, 7,003 bytes**이고 내용은 평면 색 사각형
169개 + 라틴 워드마크 8글자다. 권고안 A의 카드는 **같은 해상도 · 같은 색 수 · 더 적은 도형**
(선화 1개 + 워드마크)이므로 **장당 5~9 KB**가 합리적 추정이다.

| 항목 | 추정 | 근거 |
|---|---|---|
| 장당 | **5~9 KB** (중앙값 7 KB) | `og.png` 실측 7,003 B와 동일 클래스의 내용 |
| 32장 총합 | **160~290 KB** (중앙값 **224 KB**) | 32 × 7 KB |
| 로케일 추가당 증가 | **0 KB** | 텍스트가 없다 |
| `public/` 총합 | 7 KB → **약 231 KB** | 기존 `og.png` 유지 |

*시간* — **`미측정`.** 이 WP는 아무것도 실행하지 않았다. 근거 있는 추정만 적는다:
chromium 콜드 스타트 **1~2초**(WP-2b가 실제로 이 저장소에서 한 작업), 컨텍스트를 재사용하면
`setContent` + 레이아웃 + 1200×630 PNG 인코딩이 장당 **40~120 ms**.
→ **32장 ≈ 3~6초.** 구현 WP는 이 추정을 **5장 스파이크로 먼저 실측**하고 보고할 것.

**저장 · 서빙 · 재생성**

- 저장: `apps/fishtilt/public/og/<kind>-<topic>.png`. Next가 `public/`을 그대로 서빙한다.
- **빌드마다 재생성이 아니라 커밋.** 근거 셋.
  1. `next build`가 Playwright에 의존하게 되면 chromium 없는 환경에서 **빌드가 깨진다.**
     배포 파이프라인이 브라우저를 요구하는 것은 정적 사이트에 과한 결합이다.
  2. 산출물이 결정적이다(같은 입력 → 같은 그림). 매 빌드 재생성이 벌어들이는 게 없다.
  3. WP-2b가 `apple-icon.png`에 대해 이미 내린 결정과 같다 — **생성 스크립트가 아니라 산출
     PNG를 남긴다.** (권고안 A는 여기서 한 걸음 더 나간다: **스크립트도 남긴다.** 32장은 손으로
     다시 만들 수 없고, 토큰이 바뀌면 재생성이 필요하기 때문이다.)
- 재생성 트리거(문서화된 규칙): `globals.css`의 해당 토큰 값 변경 · `contentArt.ts` 변경 ·
  `CONTENT_TOPICS`/`CONTENT_KINDS` 유니온 변경 · 워드마크 변경.
  앞의 둘 중 팔레트는 **[1]의 단위 테스트가 자동으로 잡고**, 유니온 추가는 **[7]의 커버리지
  테스트가 자동으로 잡는다**(파일 없음 → 실패). 그림 자체의 변경만 자동 검출이 안 되므로,
  필요하면 `public/og/MANIFEST.json`에 `contentArt.ts`의 내용 해시를 넣고 테스트가 대조한다 —
  **선택 사항**으로 남긴다.
- 캐시 버스팅: 파일명이 아니라 **쿼리 문자열**로. Next의 `icon.svg`/`apple-icon.png`가 이미
  빌드 HTML에서 `?…`를 붙인다(WP-2b가 확인). 파일명에 해시를 넣으면 §7의 양방향 고아 검출이
  불가능해진다.

**실패했을 때 무엇으로 되돌아가는가**

세 층으로 막는다.

1. **생성이 실패해도 사이트는 멀쩡하다.** `public/og/`가 통째로 없으면 `[7]`의 커버리지 테스트가
   실패하고, `ogImageFor`는 폴백 분기를 갖는다 → **`/og.png`.** 즉 오늘의 상태로 정확히 돌아간다.
2. **부분 실패(32장 중 몇 장 누락)도 같은 테스트가 잡는다.** 커밋 전에 걸린다.
3. **롤백은 파일 삭제 한 번.** `ogImageFor`가 항상 `OG_IMAGE_PATH`를 반환하도록 되돌리는 것은
   한 줄이다. DB도 마이그레이션도 없다.

`og:image`가 404이면 대부분의 크롤러는 **카드 없이** 제목·설명만 보여준다 — 깨진 이미지가 아니라
텍스트 카드로 열화된다. 그래도 [7] 때문에 그 상태로 배포될 수 없다.

#### 4-2. 선택지 B — 제목을 구운 카드 53장 (정적 18 + learn 15 + blog 20)

- 얻는 것: 피드에서 카드 자체가 제목을 말한다. **다만 제목은 이미 `og:title`로 옆에 렌더된다**
  (§4-0). 순수 이득은 "디자인된 카드처럼 보인다"는 심미적 인상이다.
- 크기 추정: `og.png` 7,003 B(라틴 8글자 포함)를 기준으로, 한글 25자 내외를 54px 안팎으로 얹으면
  안티에일리어싱 엣지가 늘어 **장당 10~18 KB**(중앙값 14 KB)로 추정한다. 한글 글리프는 라틴보다
  획이 조밀해서 라틴 대비 상향 조정한 값이다.
  → **53 × 14 KB ≈ 740 KB**, 시간 ≈ 6~10초.
- **로케일당 전부 재생성.** 경로에 로케일 세그먼트가 필요하다:
  `public/og/<locale>/<kind>-<slug>.png`. 로케일 2개면 106장 ≈ 1.5 MB, 3개면 159장 ≈ 2.2 MB.
- ruling 112 판정: **위반은 아니다.** 스크립트 자동 생성이라 로케일이 늘면 스크립트를 다시
  돌리면 되고, 이는 ruling 112가 걱정한 "113장을 손으로 다시 만드는" 상황이 아니다. 하지만
  ruling 112가 보호하려던 **비용 자체**는 그대로 발생한다(저장소 바이트 · 재생성 · 로케일 경로).

#### 4-3. 선택지 C — 131장 전부

- **권고하지 않는다.** 131 × 14 KB ≈ **1.8 MB**, 로케일당 1.8 MB 추가. 시간 ≈ 12~22초.
- 가장 큰 덩어리인 **글로서리 58장**이 가장 약한 근거를 갖는다 — 용어 페이지는 문장 속 링크로
  공유되지 카드로 공유되지 않는다. §2-6의 반복 문제가 OG에서도 똑같이 생긴다.

#### 4-4. 선택지 D — 도입하지 않는다 (현상 유지)

**이 선택지의 비용을 정직하게 적는다.**

- 131개 페이지가 전부 같은 카드다. 카카오톡 대화방에 `/learn/pot-odds`와 `/glossary/term-outs`를
  연달아 붙이면 **두 링크가 시각적으로 구별되지 않는다.**
- 검색 결과·Discover에서 브랜드 식별이 워드마크 하나에 의존한다.
- **비용은 0이 아니지만, 파국도 아니다.** 제목·설명은 정상 전송되고 카드는 브랜드로서 일관되다.
  현재 `og.png`는 **잘 만들어져 있다** — 워드마크 + 13×13 모티프는 이 사이트가 무엇인지 정확히
  말한다.
- 이 선택지의 진짜 문제는 자산이 아니라 **`SITE_ORIGIN`이 아직 플레이스홀더**(ruling 110)라서
  현재로선 어떤 OG도 실제로 크롤링되지 않는다는 것이다. 즉 **OG 작업은 도메인 확정 이후가
  자연스러운 순서**다.

#### 4-5. 결론

| | 파일 | 크기 | 시간(추정) | 로케일당 | ruling 112 | 권고 |
|---|---|---|---|---|---|---|
| **A** | 32 | ~224 KB | 3~6초 | **+0** | 완전 부합 | **★ 권고** |
| B | 53 | ~740 KB | 6~10초 | ×N | 부합하나 비용 발생 | 조건부 |
| C | 131 | ~1.8 MB | 12~22초 | ×N | 부합하나 비용 큼 | 반대 |
| D | 1 | 7 KB | 0 | +0 | 부합 | 허용 가능 |

**권고: A.** 이유 셋 — (1) 페이지별 OG가 실제로 벌어들이는 것은 주제 식별이고 그건 `topic`
8종으로 충분하다, 제목은 이미 `og:title`이 나른다. (2) 로케일 비용이 **정확히 0**이라 다국어
확장 결정과 충돌하지 않는 유일한 선택지다. (3) 기존 8종 그림을 재사용하므로 두 번째 시각 시스템이
생기지 않고, 실패 시 폴백이 이미 존재하는 `og.png`다.

**시점 권고: WP-7이 `SITE_ORIGIN`을 실제 도메인에 연결한 다음.** 그 전에는 검증할 수 있는
것이 파일 존재 여부뿐이다.

---

### 5. 텍스트 포함 썸네일 시스템

오케스트레이션 프롬프트가 요구한 "제목 + 서브텍스트 + 카드 일러스트 + 일관된 색상"의 재사용
가능한 템플릿은 **이미 존재한다.** 다만 한 장의 그림 안이 아니라 **하나의 카드 컴포넌트 안**에서
성립한다 — 그림은 SVG, 제목·서브텍스트는 그 옆 DOM 텍스트, 색은 kind 토큰.

**핵심 구분 (이 절의 전부)**

> **화면 안**에서는 텍스트가 DOM이라 구울 필요가 없다.
> **화면 밖**(OG)에서는 텍스트를 `og:title`이 이미 나르므로 구울 필요가 없다.
> 따라서 **이 사이트에는 사용자에게 보이는 텍스트를 래스터에 구워야 할 자리가 없다.**
> ruling 112와의 충돌은 원천적으로 발생하지 않는다.

#### 템플릿 A — 카드 썸네일 (화면 안, 목록)

| 항목 | 규격 |
|---|---|
| 구성 | `LinkCard` = [`visual` 슬롯: `ContentThumbnail size="card"`] + `h3` 제목 + 설명 1줄 + `chips`(topic 라벨) + 메타(`초급 · 약 3분`) |
| 비율 · 좌표계 | **16:5**, viewBox `0 0 160 50`, `rounded-md` |
| 표면 | `bg-ground-800` 우물 + `border border-line-500`. 카드(`panel-700`) **안으로 패인다** — 20장이 20개의 버튼으로 읽히지 않게 하는 장치 |
| 그림 | topic 8종. 선 굵기 1.5 단일, `fill="none"` + `strokeLinejoin="round"` |
| 색 | 도형은 전부 `currentColor`. 중립선 = `text-line-500`, 강조 = kind 4종(`learn`→`act-call-500`, `blog`→`brand-500`, `glossary`→`text-300`, `hands`→`act-raise-500`) |
| 노드 예산 | **≤40** (단위 테스트 + e2e). 실측 7~12 |
| 텍스트 | SVG `<text>` **0개**. 제목·설명·칩·메타는 전부 DOM |
| 접근성 | `aria-hidden="true"`, `role="presentation"` (§6 규칙 1) |
| 래스터 | 0 |

#### 템플릿 B — 상세 hero (화면 안, 문서 상단)

| 항목 | 규격 |
|---|---|
| 구성 | 아이브로 → `h1` → 칩 + 메타 → `ContentThumbnail size="hero"` |
| 비율 · 좌표계 | **24:5**, viewBox `0 0 240 50`, `rounded-lg`. 그림 원본은 A와 **같은 160×50 한 벌**을 x+40 이동해 중앙 정렬 → 클릭한 그림과 도착한 그림이 동일 |
| 나머지 | A와 동일 |

#### 템플릿 C — OG 카드 (화면 밖, **유일한 진짜 래스터**)

| 항목 | 규격 |
|---|---|
| 크기 | **1200×630 PNG**, 8-bit RGB, 알파 없음(기존 `og.png`와 동일 포맷) |
| 테마 | **다크 고정.** OG는 뷰어 테마를 알 수 없다 |
| 구성 | `ground-900` 바탕 · 좌측 하단 `FISHTILT` 워드마크 + 브랜드 레드 밑줄 · 우측 또는 중앙에 topic 선화(큰 스케일) |
| 텍스트 | **워드마크뿐.** 라틴 브랜드 이름 = 지역화 대상 아님. 그 밖의 글자 0자 |
| 색 | kind 4종 강조색 + `line-500` 중립선. 팔레트 밖 색 금지 |
| 파일 수 | **32** (`<kind>-<topic>.png`) + 폴백 `og.png` 1 |
| 로케일 | **세그먼트 불필요**(텍스트가 없으므로) |

#### 만약 소유자가 그래도 제목을 굽기를 원한다면 (템플릿 C-B)

- 경로에 **로케일 세그먼트 필수**: `public/og/<locale>/<kind>-<slug>.png`.
- 제목은 레코드의 `title`에서만 온다. **템플릿에 한국어를 손으로 적지 마라.**
- 줄바꿈: 한글은 어절 단위로 접고, 2줄 초과 시 말줄임. 폰트는 시스템 스택(ruling 111) —
  **렌더 머신의 폰트에 따라 결과가 달라진다**는 사실을 반드시 기록할 것. 재현성이 필요하면
  그때 처음으로 폰트 파일 논의가 열린다(현재 ruling 111이 막고 있음).
- 크기·시간은 §4-2.

---

### 6. alt 텍스트 전략

현재 상태는 뒤섞여 있지만 **일관된 규칙이 이미 암묵적으로 지켜지고 있다.** 그 규칙을 명시한다.

#### 판정 규칙 (순서대로 적용)

**규칙 0 — 한 문장 판정법**
> **"이 그림을 지웠을 때, 페이지에서 사라지는 사실이 있는가?"**
> 없으면 장식이다. 있으면 그 사실을 **문장으로** 써라.

**규칙 1 — 옆에 텍스트가 이미 있으면 `aria-hidden="true"`**
그림이 담은 정보가 인접 DOM 텍스트에 전부 있으면 장식이다. 이름을 붙이면 스크린리더가 같은 말을
두세 번 한다.
- `ContentThumbnail` → 제목이 바로 옆에, topic이 칩으로 또 있다. **세 번 말하게 된다.**
- `OutsFigure` / `PotOddsFigure` → 범례가 모든 수치를 말로 진술한다.
- `PositionLegend` → 각 자리 버튼이 `positionAccessibleName()`을 자기 이름으로 갖고 있다.

**규칙 2 — 그림에만 있는 정보가 있으면 `role="img"` + `aria-label`**
그리고 **라벨은 그 정보를 명제로 진술**해야 한다.
- `HomeHeroVisual` → "어느 칸이 표시되어 있는가"는 그림에만 있다. 라벨:
  `"버튼(BTN) 자리의 학습용 기본 레인지를 작게 그린 표. AKs 칸이 표시되어 있습니다."`
- `PokerCard` → 카드 한 장의 랭크·무늬는 글리프에만 있다. 라벨: `"스페이드 A"`.

**규칙 3 — 매체를 설명하는 라벨 금지**
`"핸드레인지 표 이미지"`, `"차트"`, `"그림"`, `"다이어그램"`, `"스크린샷"`은 **전부 금지**다.
매체는 `role`이 이미 말했다. 라벨은 **그림이 주장하는 내용**을 말해야 한다.

| 나쁨 | 좋음 | 왜 |
|---|---|---|
| `"핸드레인지 표 이미지"` | `"버튼(BTN) 자리의 학습용 기본 레인지. AKs 칸이 표시되어 있습니다."` | 앞은 매체를, 뒤는 내용을 말한다 |
| `"아웃츠 다이어그램"` | (라벨 없음 — `aria-hidden`) | 범례가 이미 `아웃츠 9장 / 아웃츠가 아닌 38장 / 플랍에서 아직 보이지 않는 카드 47장`을 말한다 |
| `"포커 카드"` | `"스페이드 A"` | 어떤 카드인지가 정보다 |
| `"팟오즈 차트"` | (라벨 없음 — `aria-hidden`) | 세 금액과 최종 팟이 아래에 텍스트로 있다 |

**규칙 4 — 라벨은 조립하고 타이핑하지 않는다**
`aria-label`은 **도메인 함수와 레코드 필드에서 조립**해야 한다. 손으로 타이핑한 라벨은
(a) 그림과 어긋날 수 있고 (b) 로케일이 늘면 놓치는 번역 대상이 된다.
`HomeHeroVisual`이 `positionAccessibleName()` + `RANGE_LABEL` + `HAND_CLASSES.length`로
조립하는 방식이 표준이다.

**규칙 5 — `<figcaption>`이 있으면 안쪽 그림은 규칙 1로 간다**
캡션이 이미 접근 가능한 설명이다. 캡션을 `aria-label`로 복제하면 두 번 읽힌다.

**규칙 6 — 순수 장식 마크는 `aria-hidden`, 예외 없음**
범례 스와치, 카드 뒷면 문양, 구분선. 크기·색만 있는 것들.

**규칙 7 — 진짜 `<img>`가 생기면**
- 장식: `alt=""`. **`aria-hidden`을 추가로 붙이지 마라** — `alt=""`만으로 접근성 트리에서
  제외된다.
- 정보: `alt`에 규칙 2·3·4를 그대로 적용.
- **금지**: 파일명, `"이미지"`, `"사진"`, `"일러스트"`, 그리고 옆 캡션의 복사.

#### 검사 방법 (테스트로 강제)

1. `container.querySelector('svg text')`가 없거나, 있으면 그 내용이 **레코드/도메인에서 온
   문자열**이어야 한다. `ContentThumbnail.test.tsx`에 이미 이 형태의 assertion이 있다.
2. `role="img"` 요소는 반드시 비어 있지 않은 `aria-label`을 갖는다.
3. `aria-label` / `alt` 문자열이 금지 단어(`이미지` `사진` `차트` `그림` `다이어그램`
   `스크린샷`)를 포함하지 않는다 — `copy-guards.test.ts`가 이미 이런 종류의 문자열 가드를
   갖고 있으므로 같은 자리에 같은 모양으로 넣는다.
4. 장식 그림(`aria-hidden`)의 정보가 **텍스트로도 존재**하는지: 그림 옆 범례/제목이 그림이
   구별하는 값들을 전부 문자열로 갖는지 검사. `OutsFigure.test.tsx`의 "말로도 진술" 테스트가
   그 패턴이다.

---

### 7. 파일명 · 저장 위치 규약

#### 디렉터리

```
apps/fishtilt/
  public/
    og.png                          ← 사이트 공용 폴백 + 허브/툴/퀴즈 카드 (기존, 유지)
    og/
      <kind>-<topic>.png            ← 권고안 A의 32장. 예: blog-odds.png, learn-range.png
      [<locale>/<kind>-<slug>.png]  ← 선택지 B/C를 택했을 때만. 로케일이 첫 세그먼트
    img/                            ← 아직 존재하지 않음. authored 이미지가 처음 들어올 때 생성
      <kind>/<slug>[-<n>].webp      ← 예: learn/positions-6max-1.webp
  src/app/
    icon.svg                        ← 파비콘 (Next 파일 컨벤션, 이동 금지)
    apple-icon.png                  ← 180×180 (Next 파일 컨벤션, 이동 금지)
```

#### 슬러그 기반 · 해시 기반

**슬러그 기반을 택한다.** 근거 셋.

1. **양방향 고아 검출이 가능하다.** 파일명이 레코드와 결합돼 있으면 "레코드는 있는데 파일이
   없음"과 "파일은 있는데 레코드가 없음"을 **테스트가 둘 다 잡는다.** `content.test.ts`가
   `PUBLISHED` 레코드의 MDX에 대해 이미 하는 검사와 같은 모양이다. 해시 파일명은 이 성질을 잃고,
   그 순간 `public/`이 고아 파일의 무덤이 된다 — ruling 106이 경계한 "404 표면"의 쌍둥이다.
2. **`slug`는 이미 유일하고 레코드가 갖고 있다.** `ContentRecord.slug`는 kind 안에서 유일하고
   Latin lower-kebab이 강제된다. 새 식별자를 만들 필요가 없다.
3. **Next의 `public/`은 해시 URL을 자동으로 만들어주지 않는다.** 해시를 쓰면 손으로 관리해야
   하는데, 그 대가로 얻는 것은 캐시 버스팅뿐이고 그건 쿼리 문자열로 더 싸게 얻는다
   (`icon.svg`/`apple-icon.png`가 이미 `?…`를 붙인다).

#### 로케일을 어디에 넣는가

**규칙: 지역화 대상 텍스트를 담은 자산만 로케일 세그먼트를 갖는다.**

| 자산 | 로케일 세그먼트 | 이유 |
|---|---|---|
| 권고안 A의 OG 32장 | **없음** | 텍스트 0자 |
| 선택지 B/C의 OG | **있음** (`og/<locale>/…`) | 제목이 구워져 있다 |
| authored 배경/일러스트 | **없음** (`img/<kind>/…`) | §9의 규칙상 글자가 없다 |
| 글자가 구워진 authored 이미지 | **금지** (ruling 112) | 애초에 만들지 않는다 |

로케일이 첫 세그먼트인 이유: `og/ko/…`, `og/en/…`이 **디렉터리 통째로** 추가·삭제·재생성
가능해야 한다. 파일명 접미사(`…-ko.png`)로 하면 로케일 하나를 지우는 데 glob이 필요하다.

#### 확장자

- **OG는 `.png`.** 기존 `og.png`가 PNG이고, 일부 크롤러의 WebP `og:image` 처리는 `미확인`이다.
  검증되지 않은 이득을 위해 소셜 카드를 걸 이유가 없다.
- **화면 안 authored 이미지는 `.webp`.** 그런 자산이 실제로 생길 때 결정하면 되고, 지금은 0개다.
- **아이콘은 `.svg` + `.png` 각 1장.** 현상 유지.

#### 파일이 들어오는 순간의 계약 (WP-5가 넘긴 것 확정)

1. **실제 이미지가 먼저, 필드가 나중.** ruling 114. `ContentRecord`에 `image?: { src, alt }`가
   추가되는 커밋은 **첫 이미지가 리포지토리에 들어오는 그 커밋**이다.
2. **끼우는 지점은 정확히 둘**: `LinkCard`의 `visual` 슬롯, 상세 페이지의
   `<ContentThumbnail size="hero">` 자리. 호출부가
   `record.image ? <AuthoredImage/> : <ContentThumbnail/>`로 분기한다. 컴포넌트 변경 0.
3. **디스크 대조 테스트를 같이 넣는다.** `content.test.ts`가 `status: 'PUBLISHED'`를 디스크와
   대조하는 그 자리에, 같은 모양으로.
4. **113장을 다 만들 필요가 없다.** 생성 썸네일이 기본, authored는 옵트인 오버라이드
   (ruling 106).

---

### 8. 성능

#### 8-1. 인라인 SVG를 택한 이유와 그 한계

**왜 인라인인가** (네 가지, 전부 이 사이트의 조건에서 나온다)

1. **요청 0개.** 131페이지 정적 프리렌더 사이트에서 이미지 파일은 페이지당 추가 왕복이다.
   `/blog` 한 페이지에서만 20 왕복이 생긴다. 현재 `/blog`의 **이미지 요청은 0개**다.
2. **테마 두 벌이 파일 두 벌 없이 성립한다.** `currentColor` + `text-*` 토큰이라 라이트/다크가
   같은 마크업으로 돈다. 파일이면 다크용·라이트용 두 벌이거나, 테마 전환 시 깜빡인다.
3. **404 표면 0.** 파일이 없으면 깨지는 것이 없다.
4. **다국어 비용 0.** 픽셀에 글자가 없다.

**언제 파일로 바꿔야 하는가 — 세 개의 임계**

| 임계 | 기준 | 현재 위치 |
|---|---|---|
| **1. 한 문서 안의 반복 × 노드 수** | 인라인 SVG는 HTML에 매번 복제된다. `그림 하나 노드 수 × 같은 문서 내 반복 횟수 > 800`이면 파일 또는 `<symbol>`+`<use>`가 싸진다 | `/blog` 실측 **175노드**(썸네일 20장 총합, 장당 평균 8.75), `main` 전체 384. **여유 4배 이상** |
| **2. 여러 *페이지*에 걸친 반복** | 인라인 SVG는 캐시되지 않는다(HTML의 일부). 같은 그림이 다수 페이지에 공통으로 들어가면 파일은 **한 번 받고 캐시**되므로 이긴다 | 현재 각 그림은 자기 topic 페이지에만. 131페이지 공통 그림이 생기면 그때 재검토 |
| **3. 선화로 표현 불가능** | 사진, 그라디언트 메시, 텍스처 | 해당 없음(§9가 이 경로를 닫는다) |

**현재 예산 대비 위치**: 썸네일 상한 40노드, 실측 7~12 → **최대치의 30%**. e2e에 상한이 박혀
있다(장당 ≤40, 썸네일 총합 <600, `main` 전체 <1200). 새 도해는 §2-5의 200노드 상한을 권고한다.

#### 8-2. lazy loading이 필요해지는 시점

- **인라인 SVG에는 개념 자체가 없다.** HTML의 일부라 별도 로드가 없다. 그래서 지금 이 사이트에
  lazy loading 논의는 존재하지 않는다.
- **파일 `<img>`가 처음 생기는 순간부터 필요**하고 기준은 **첫 화면(fold) 밖**이다.
  - `/blog` 2열 그리드에서 1280px 기준 첫 화면에 카드 약 4장 → **나머지 16장은
    `loading="lazy"`**. 375px 1열이면 첫 화면 1~2장 → 나머지 전부 lazy.
  - **상세 페이지 상단 대표 이미지는 절대 lazy 금지.** LCP 요소다. `fetchpriority="high"`.
  - 본문 중간 `Figure` 안의 이미지는 전부 lazy.
- `width`/`height` 속성(또는 `aspect-ratio`)을 **반드시** 명시한다. 없으면 lazy 이미지가
  로드될 때 CLS가 발생한다. 현재 이 사이트의 CLS 위험은 0에 가깝다 — 그걸 버리는 결정이다.

#### 8-3. 131페이지 정적 프리렌더에서 이미지가 늘 때, 무엇이 먼저 아픈가 (순서대로)

1. **`public/` 크기와 배포 산출물.** Next는 `public/`을 **통째로** 복사한다. 트리셰이킹도
   사용처 분석도 없다. 131장 × 14 KB = 1.8 MB가 **모든 배포에** 들어가고, 로케일마다 곱해진다.
   이게 가장 먼저, 가장 확실하게 아프다.
2. **404 표면.** `image.src`가 가리키는 파일이 없어도 **빌드는 통과한다.** 이게 ruling 106이
   말한 유지보수 부채의 실체이고, 방어 수단은 §7-4의 디스크 대조 테스트 하나뿐이다. 그
   테스트가 없으면 113개의 잠재적 404가 생긴다.
3. **LCP.** 지금 상세 페이지의 LCP 요소는 `<h1>`이고 이미지 요청이 0개다 — **매우 유리한
   출발점**이다. 상단에 진짜 래스터가 오는 순간 LCP가 텍스트에서 이미지로 바뀐다. 되돌리기
   어려운 변화이므로 명시적 결정이어야 한다.
4. **HTML 전송 크기.** 인라인 SVG를 계속 늘리면 여기가 아프다. 다만 gzip/brotli가 반복 구조를
   잘 누르므로 §8-1 임계 1에 걸리기 전까지는 늦게 온다.
5. **빌드 시간.** `public/` 복사는 선형이고 싸다. `next/image` 최적화를 켜지 않는 한(현재 사용
   0건) 여기는 **가장 나중에** 아프다.
6. **대역폭·캐시.** 정적 호스트/CDN이 처리한다. 실질적으로 마지막.

**즉, 이미지 도입의 비용은 성능이 아니라 (1) 배포 산출물 크기와 (2) 404 유지보수 표면이다.**
이 두 가지가 ruling 106의 판단을 뒷받침한다.

---

### 9. AI 생성 이미지를 쓸 것인가

#### 9-1. 정직한 출발점

**이 사이트의 시각 요소는 지금까지 예외 없이 실제 도메인 데이터에서 나왔다.**

- `HomeHeroVisual`의 채워진 칸 = `resolveRange({BTN, RFI, 100BB, 6인})`의 실제 답
- `PokerCards`의 두 장 = `learn-core` `handClassFacts`의 그 클래스 대표 콤보
- `OutsFigure`의 47칸 = `outsOdds`의 `unseenCards`
- `PotOddsFigure`의 막대 폭 = `Money.ratio`
- `categoryFrequency` = `C(52,5) = 2,598,960` 전수 계산
- 심지어 `ContentThumbnail`의 장식조차 **랭크·무늬·퍼센트·채워진 레인지를 일부러 그리지
  않는다** — 장식 컴포넌트가 포커 사실을 주장하면 CLAUDE.md 규칙 2에 걸리기 때문이다.

**이건 우연이 아니라 이 제품의 성격이다.** FishTilt가 파는 것은 정확성이고, 그림도 같은 규율
아래 있어 왔다.

#### 9-2. AI 생성 장식 일러스트를 섞으면 무엇을 얻고 무엇을 잃는가

**얻는 것 (실재한다, 무시하지 않는다)**

- 표지의 다양성. 블로그 20편의 hero가 8종 그림을 돌려 쓰므로 **시각적 단조로움이 실제로
  있다**(WP-5 §남은 이슈 2가 1편짜리 그룹 6개를 이미 지적했다).
- 감정적 온도. 선화 기하는 정확하지만 차갑다. 초보자 우선 사이트에서 이건 진짜 손실이다.
- 브랜드 기억. 인상적인 이미지 한 장이 워드마크보다 오래 남는다.

**잃는 것 (구체적으로)**

1. **정확성 서약의 균열.** 지금까지 이 사이트의 모든 그림은 "여기 그려진 것은 계산된 것"이라는
   약속을 지켜 왔다. AI 일러스트가 옆에 오는 순간 독자는 **어느 그림이 데이터고 어느 그림이
   장식인지 구별할 근거를 잃는다.** 이건 픽셀의 문제가 아니라 신뢰의 문제다.
2. **포커 사실 오류.** 생성 모델은 카드 족보·무늬·랭크·칩·좌석 수를 거의 항상 틀린다 —
   보드가 6장이 되고, 스트레이트가 스트레이트가 아니고, 존재하지 않는 랭크가 나온다.
   **이 사이트는 초보자에게 족보를 가르치는 사이트다.** 틀린 족보 그림 한 장이 레슨 하나를
   통째로 무효화하고, `/hands` 20편과 `/practice/hand-ranking-quiz`의 신뢰도까지 끌고 내려간다.
3. **다국어 비용.** 생성 이미지에 글자가 있으면 ruling 112 위반이고, 생성 모델은 한글을
   신뢰할 수 있게 쓰지 못한다.
4. **출처 진술 가능성.** 이 저장소에는 `scripts/check-licence-hygiene.mjs`가 있다 — **라이선스
   위생을 이미 검사하는 저장소**다. 출처를 진술할 수 없는 자산이 들어오면 그 검사의 전제가
   약해진다.
5. **§8이 정리한 성능·유지보수 비용 전부.** 이미지 요청 0개, 404 표면 0, LCP가 텍스트라는
   현재의 유리한 성질을 잃는다.

#### 9-3. 권고

> **지금은 도입하지 않는다.** 같은 예산을 §3의 학습 다이어그램 8종에 쓴다.

근거: (a) 블로그 hero의 단조로움은 실재하지만, 그 해법은 AI 일러스트가 아니라 **topic 안에서
그림을 2~3 변형으로 늘리는 것**이다 — 데이터 기반이고, 결정적이고, 로케일 비용 0이며, 이미
있는 시스템의 연장이다. (b) 학습 레슨 15편의 본문 도해 0편이 훨씬 큰 공백이고, 그 그림들은
**독자가 실제로 이해하지 못하는 것을 이해하게 만든다.** 장식은 그렇지 않다.

#### 9-4. 그래도 도입한다면 — 허용 경계

**한 줄 판정법**

> **"이 그림이 틀릴 수 있는가?"**
> 틀릴 수 있으면 생성하지 마라. 배경 그라디언트는 틀릴 수 없다. 카드 그림은 틀릴 수 있다.

| | 허용 | 금지 |
|---|---|---|
| **소재** | 추상 배경, 텍스처, 그라디언트, 기하 패턴, 분위기용 질감 | 카드 · 칩 · 족보 · 테이블 · 딜러 · 손 · 사람 · 얼굴 · 주사위 · 돈 · 카지노 |
| **글자** | 없음 | **모든 문자와 숫자** (ruling 112 + 모델이 한글을 못 씀) |
| **역할** | **배경 레이어 전용** | 정보를 담는 레이어, 도해, 설명 |
| **배치** | 그 위의 제목·라벨은 **항상 DOM 텍스트**, `scrim-900` 위에 | 이미지에 텍스트 합성 |
| **위치** | 블로그 상세 상단 배경, 허브 섹션 배경 | 레슨 본문 도해 자리, 툴 페이지, 퀴즈, 글로서리 |

**"포커 사실을 묘사하는 건 안 되는 이유"를 다시 못 박아 두면**: 잘못 그려진 카드나 틀린 족보는
이 사이트가 지켜온 정확성을 **직접** 훼손한다. 다른 사이트에서는 장식의 부정확이 무해하지만,
족보를 가르치는 페이지 옆의 틀린 족보 그림은 그 페이지의 주장과 **모순**한다. 독자가 그 모순을
발견하는 순간, 그가 잃는 신뢰는 그 그림 한 장이 아니라 사이트 전체다.

#### 9-5. 도입 시 프롬프트 자산 규격

| 항목 | 규격 |
|---|---|
| **비율 · 산출** | 생성은 정사각 또는 16:9로 뽑고 크롭. 최종: 24:5(상세 hero) / 16:5(카드) / 1200×630(OG). 긴 변 1600px, `.webp` q80, **장당 ≤120 KB** |
| **스타일 지시** | `flat, non-photographic, no gloss, no 3D render, no lens flare, no bokeh, minimal geometric abstraction, soft large shapes` |
| **선(line)** | **배경에 선이 없어야 한다.** 이 사이트의 전경은 선화이고, 배경에 선이 있으면 전경과 경쟁한다 |
| **색 (팔레트 밖 금지)** | `ground-900 #090a0d` · `panel-700 #171b21` · `brand-500 #ff334d` · `brand-600 #d71e36` · `act-raise-500 #e4572e` · `act-call-500 #2ba3a3`. **채도는 브랜드 레드보다 낮게** — 배경이 브랜드보다 튀면 안 된다 |
| **명도 제약** | 그 위에 `text-100`(`#f5f6f7`)이 올라가므로 **4.5:1을 유지**해야 한다. 실무 규칙: 배경 이미지 위 텍스트에는 항상 `scrim-900`을 깔고, **그래도 계산된 스타일로 대비를 측정**한다(WP-2 규약 — 스크린샷 아님) |
| **금지 프롬프트 요소** | `playing card, poker chip, casino, dealer, table felt, dice, money, currency, hand, person, face, text, letters, numbers, korean, hangul, logo, watermark, signature` |
| **출처 기록** | `public/img/CREDITS.md`에 파일명 · 모델명 · 버전 · 프롬프트 전문 · 생성 일자를 기록. `check-licence-hygiene.mjs`가 있는 저장소이므로 출처 진술 가능성을 확보해 둔다 |
| **수용 검사** | (1) 위 금지 소재가 하나도 보이지 않는가, (2) 팔레트 밖 색이 없는가(색 히스토그램), (3) `scrim-900` 위 `text-100` 대비 ≥4.5:1(계산), (4) 파일 ≤120 KB, (5) 라이트 테마에서도 성립하는가 — **성립하지 않으면 테마별 두 벌이 아니라 도입 취소**(두 벌은 §8의 비용을 두 배로 만든다) |

---

## 변경 파일

### 신규 (1)

| 파일 | 내용 |
|---|---|
| `docs/reports/FISHTILT_WP6_VISUAL_ASSET_PLAN.md` | 이 문서 |

### 수정 · 삭제

**없음. 소스 코드 변경 0줄, 이미지 파일 생성 0개, `public/` 변경 0건.**

## 테스트 / 검증

**코드 변경 없음 — 기존 구현에 대한 사실은 소스를 직접 읽어 확인했다.**
빌드·e2e·dev 서버를 실행하지 않았다(ruling 108: 포트 3221과 `.next`는 다른 에이전트가 사용 중).
읽기와 `grep`만 수행했다.

### 실제로 연 파일

**문서**

- `CLAUDE.md`
- `docs/FISHTILT_STATE.md` (Stage 2 execution graph 전체 — ruling 100~114 포함)
- `docs/reports/FISHTILT_WP2_DESIGN_SYSTEM.md` (§1 토큰 표, §10 파비콘, WP-2b §3 apple-icon)
- `docs/reports/FISHTILT_WP3_HOME_REDESIGN.md` (§1 섹션 표, §2 히어로 시각 요소, §WP-5/WP-8 인계)
- `docs/reports/FISHTILT_WP5_BLOG_AND_IMAGE_SYSTEM.md` (전문)

**소스 — 전문을 읽은 것**

- `apps/fishtilt/src/components/ContentThumbnail.tsx`
- `apps/fishtilt/src/components/HomeHeroVisual.tsx`
- `apps/fishtilt/src/components/Figure.tsx`
- `apps/fishtilt/src/components/OutsFigure.tsx`
- `apps/fishtilt/src/components/PotOddsFigure.tsx`
- `apps/fishtilt/src/lib/seo/site.ts`
- `apps/fishtilt/src/lib/seo/metadata.ts`
- `apps/fishtilt/src/content/types.ts`
- `apps/fishtilt/src/app/icon.svg`
- `apps/fishtilt/package.json`
- `apps/fishtilt/playwright.config.ts`
- `apps/fishtilt/public/og.png` (이미지로 직접 열람 + PNG IHDR 파싱)

**소스 — 부분을 읽은 것**

- `apps/fishtilt/src/components/PokerCard.tsx` (렌더 본문 `:130-175`)
- `apps/fishtilt/src/components/PokerCards.tsx` (`:1-45`)
- `apps/fishtilt/src/components/QuizVisual.tsx` (전문 30줄)
- `apps/fishtilt/src/components/PositionLegend.tsx` (`:1-45`)
- `apps/fishtilt/src/components/RangeMatrixMini.tsx` (`:1-45`)
- `apps/fishtilt/src/components/HomeRangePreview.tsx` (`:1-30`)
- `apps/fishtilt/src/lib/routes.ts` (`ROUTES` 18개 항목)
- `apps/fishtilt/src/content/registry/learn/{h1,h2,h3,published,index}.ts` (15개 레슨의
  `id`/`slug`/`order`/`title`/`level`/`topic`/`status`)
- `apps/fishtilt/src/app/page.tsx` (섹션 `aria-label` 8개, 시각 컴포넌트 호출부)
- `apps/fishtilt/src/app/blog/page.tsx`, `src/app/blog/[slug]/page.tsx` (`ContentThumbnail`
  호출부)
- `apps/fishtilt/src/app/glossary/[slug]/page.tsx`, `src/app/hands/[hand]/page.tsx`,
  `src/app/learn/[slug]/page.tsx`, `src/app/about/page.tsx` (컨테이너 폭)
- `apps/fishtilt/src/app/tools/pot-odds/page.tsx` (툴 페이지 구조)

**실행한 조회 (전부 읽기 전용)**

| 명령 | 확인한 것 |
|---|---|
| `ls -la apps/fishtilt/public/` | 파일 1개(`og.png`, 7,003 B) |
| PNG IHDR 파싱 (`python3`) | `og.png` = 1200×630, bit depth 8, colortype 2(RGB, 알파 없음) |
| `ls -la apps/fishtilt/src/app/` | `apple-icon.png` 1,542 B, `icon.svg` 606 B |
| `grep -rnE "<img\|next/image\|<Image[ /]"` | `src/`·`content/`·`mdx-components.tsx`에서 **0건** |
| `grep -rln "<svg"` (src/components) | 4개 파일 — `ContentThumbnail` `OutsFigure` `SiteHeader` `ThemeToggle` |
| `grep -rn 'role="img"'` | 실사용 3곳 — `HomeHeroVisual` `PokerCard` `HandChecker` |
| `grep -rl "PokerCards" content/` | MDX **53편** |
| `grep -rl "RangeMatrixMini" content/` | MDX **10편** |
| `grep -rl "<Figure" content/` | MDX **3편** (`outs-nine` `pot-odds-quick` `why-use-range`) |
| `find content -name '*.mdx'` (kind별) | learn 15 · blog 20 · glossary 58 · hands 20 = **113** |
| `grep -rn "max-w-\[42rem\]" src/` | 라우트 **4곳** + 컴포넌트 2곳에 리터럴 잔존 |
| `grep -rho "max-w-\(reading\|grid\|shell\|matrix\)"` | reading 16 · shell 12 · grid 5 · matrix 1 |
| `grep -rln "PositionLegend"` | 4개 컴포넌트가 임포트 |

### `미확인` / `추정`으로 남긴 것

| 항목 | 상태 | 비고 |
|---|---|---|
| `HomeHeroVisual` / `HomeRangePreview` / `RangeMatrix`의 **컴포넌트 총 DOM 노드 수** | **미확인** | 격자 169개는 WP-5 실측 인용. 총계는 브라우저 실측이 필요하고 이 WP는 서버를 띄우지 않았다 |
| `OutsFigure` 약 57노드, `PotOddsFigure` 약 15노드, `PokerCard` 3노드 | **계산** | 소스에서 요소를 셌다. 실측 아님 |
| OG 카드 장당 5~9 KB / 10~18 KB | **추정** | 근거: `og.png` 1200×630 = 7,003 B 실측. 권고안 A는 같은 클래스(더 적은 도형) → 하향, 선택지 B는 한글 글리프 추가 → 상향 |
| OG 생성 시간 3~6초 | **추정** | 근거: chromium 콜드 스타트 1~2초(WP-2b가 이 저장소에서 실제 수행), 장당 40~120 ms. **구현 WP가 5장 스파이크로 실측할 것** |
| 크롤러의 WebP `og:image` 지원 범위 | **미확인** | 그래서 OG는 PNG를 유지한다 |
| 카카오톡 링크 미리보기의 정확한 렌더 규칙 | **미확인** | "이미지 + 제목 텍스트 + 설명 텍스트" 구조라는 일반적 사실에 근거했다. §4-0의 결론은 Twitter/Facebook/Slack/Discord만으로도 성립한다 |

## SEO/UX 관점의 영향

**이 문서 자체는 코드 변경이 0이므로 현재 SEO·UX 지표를 바꾸지 않는다.** 아래는 계획이
실행됐을 때의 예상 영향이다.

**계획이 실행되면 얻는 것**

- **OG 권고안 A**: 131개 페이지의 소셜 카드가 32종으로 갈라진다. 공유 링크가 주제별로
  구별되고, 검색·Discover의 이미지 슬롯에서 브랜드 식별이 생긴다. `og:title`/`og:description`은
  지금과 동일하게 텍스트로 전송되므로 **텍스트 SEO 표면은 변하지 않는다** — 순수 추가다.
- **학습 다이어그램 8종**: 15편 레슨의 체류 시간과 이해도에 직접 작용한다. `Figure` 캡션이
  `measureContent`에 잡히지 않으므로 **`readMinutes`와 900자 색인 하한이 흔들리지 않고**,
  따라서 레지스트리 레코드가 한 줄도 바뀌지 않는다 → `indexable` 판정 변화 0.
- **`<figure>`/`<figcaption>` 시맨틱**: 크롤러가 그림과 설명의 연결을 읽는다. 현재 레슨
  15편에는 그 연결이 하나도 없다.

**의도적으로 주지 않는 것**

- **`ImageObject` / `datePublished` / `aggregateRating` 스키마 없음.** ruling 105·107.
  인라인 SVG는 URL이 없어서 `ImageObject`가 가리킬 대상 자체가 없다. OG 카드가 생기면
  `ImageObject`를 붙일 수는 있으나, **페이지가 실제로 그 이미지를 렌더하지 않으므로**
  ruling 107("구조화 데이터는 페이지가 실제로 렌더하는 것만 기술한다")에 걸린다. **붙이지 마라.**
- **이미지 사이트맵 없음.** 같은 이유.
- **날짜 관련 아무것도 없음.** ruling 105.

**위험**

- **LCP.** §8-3의 3번. 상세 페이지 상단에 진짜 래스터가 오면 LCP 요소가 `<h1>`에서 이미지로
  바뀐다. 권고안 A는 OG만 래스터이고 **페이지에 렌더되지 않으므로 LCP에 영향이 없다** — 이것도
  A를 권고하는 이유 중 하나다.
- **`SITE_ORIGIN` 미확정**(ruling 110). 도메인이 붙기 전에는 어떤 OG도 실제로 크롤링되지
  않는다. **OG 작업의 자연스러운 순서는 도메인 확정 이후다.**

## 남은 이슈

1. **OG 파이프라인의 시간 추정이 미측정이다.** 구현 WP는 **5장 스파이크**로 chromium 기동
   시간과 장당 렌더 시간을 먼저 실측하고, 32장 총계를 추정이 아니라 실측으로 보고할 것.
2. **`contentArt.ts` 추출은 `ContentThumbnail.tsx`를 건드린다.** OG 생성기와 화면 썸네일이
   그림 한 벌을 공유하려면 필요한 리팩터링이지만, WP-5가 방금 만든 파일이다. 구현 WP는 **추출
   전후로 `ContentThumbnail.test.tsx`의 32조합 테스트가 그대로 통과하는지** 먼저 확인할 것.
   추출이 부담이면 **OG를 뒤로 미루는 것이 그림을 두 벌로 만드는 것보다 낫다.**
3. **`max-w-[42rem]` 리터럴이 4개 라우트에 남아 있다** — `learn/[slug]:88`,
   `glossary/[slug]:73`, `hands/[hand]:140`, `about:26`. WP-5가 `blog/[slug]` 하나만 고쳤다.
   ruling 113(다섯 번째 폭은 측정과 토큰이 필요하다)에 걸린다. **WP-6의 소관이 아니므로 고치지
   않았고, WP-8에 보고한다.** 참고로 `PageHero.tsx:38`과 `SectionHeading.tsx:32`의 같은 리터럴은
   **컨테이너가 아니라 산문 줄길이 제한**이라 성격이 다르다 — 함께 묶어 판단하지 말 것.
4. **`icon.svg`가 색 3개를 하드코딩한다**(`#ff334d`, `#ffffff`, `opacity 0.42`). 파비콘은 CSS
   토큰에 접근할 수 없으므로 불가피하지만, **브랜드 레드가 바뀌면 여기와 `apple-icon.png`를 손으로
   따라가야 한다.** 토큰 값과의 일치를 `theme-tokens.test.ts`가 검사하도록 넣을 수 있다 —
   저비용 안전장치. 미배정.
5. **`why-blinds-exist`·`why-called-3bet`의 그림 없음이 §3-1의 7·10번으로 해소된다** —
   WP-5가 WP-6에 넘긴 열린 항목의 답이다. **`BetCountFigure`는 순번만 그리고 금액을 그리지
   않는다**는 것이 그 해법의 전부다.
6. **블로그 hero의 시각적 단조로움(8종 반복)은 여전히 열려 있다.** §9-3이 "topic 안에서 2~3
   변형"을 제안했지만 구체적 디자인은 하지 않았다. WP-8의 시각 리뷰가 실물을 보고 판단할 사안.
7. **`/learn` 허브 썸네일**은 WP-5의 권고("지금은 켜지 마라")를 이 문서가 5개 허브 전체로
   확장했다. 켜는 비용이 한 줄이므로 미루는 비용도 0이다. **WP-8이 최종 판단.**

## 다음 WP에 넘길 사실 요약

### WP-7 (SEO · 메타데이터 · JSON-LD)가 이어받을 것

1. **OG 배선 지점은 정확히 두 파일이다.** `src/lib/seo/site.ts`의 `OG_IMAGE_PATH` 상수와
   `src/lib/seo/metadata.ts:61`의 `OG_IMAGE` 객체. 후자를 `ogImageFor(record?)` 함수로 바꾸고
   `contentMetadata`가 레코드를 넘기면 끝이다. `pageMetadata`의 기본값은 `/og.png`를 유지한다.
2. **권고는 권고안 A(32장)이고, 시점은 `SITE_ORIGIN` 확정 이후다.** ruling 110이 도메인을
   열어 뒀으므로, 도메인이 붙기 전에는 OG를 크롤러가 보지 못한다. **선택지 D(현상 유지)도 완전히
   정당하며 그 비용은 §4-4에 적혀 있다.**
3. **`ImageObject` 스키마를 붙이지 마라.** OG 카드는 페이지가 렌더하지 않는 이미지이고,
   ruling 107은 구조화 데이터가 페이지가 실제로 렌더하는 것만 기술하게 한다.
4. **이미지 사이트맵도 만들지 마라.** 같은 이유. 사이트맵은 130 URL 그대로.
5. **`/og/` 디렉터리가 생기면 정적 라우트가 늘어난다.** `/icon.svg`·`/apple-icon.png`와
   마찬가지로 **사이트맵·robots에 포함되지 않는지** 확인할 것.

### WP-8 (최종 QA)가 이어받을 것

- **§남은 이슈 3** — `max-w-[42rem]` 리터럴 4개 라우트(ruling 113).
- **§남은 이슈 6·7** — 블로그 hero 단조로움, `/learn` 허브 썸네일 on/off 최종 판단.
- WP-5가 넘긴 두 건(주제 칩과 그룹 헤딩 중복, 1편짜리 그룹의 빈 칸)도 같은 시각 리뷰에서.
- **새 시각 요소를 검사할 때는 스크린샷이 아니라 계산된 스타일로 대비를 측정할 것**(WP-2 규약).
- 히어로에 `role="group"`을 붙이지 말 것, 히어로의 채움 CTA를 없애지 말 것(WP-3 인계 유지).

### 구현 WP(미배정)가 이어받을 것

**즉시 착수 가능, 신규 코드 0줄** — §3-1의 1·2번:
`/learn/outs`에 `<Figure><OutsFigure outs={…} street="FLOP" /></Figure>`,
`/learn/pot-odds`에 `<Figure><PotOddsFigure pot="…" bet="…" /></Figure>`.
두 컴포넌트 모두 MDX 허용 목록에 이미 있고, 캡션이 프롭이라 `readMinutes`가 안 흔들린다.
**레지스트리 레코드 변경 0.**

**신규 컴포넌트 8종** — §3-1의 3·4·6·7·8·9·10번. 각각 §3-3의 공통 규율 6개를 지킨다.
데이터 출처와 "금액을 그리지 않는다" 같은 개별 규율은 §3-2 표에 있다.

**OG 파이프라인** — §4-1의 [1]~[7]. 새 의존성 0개(Playwright 재사용), 별도
`playwright.og.config.ts`로 `pnpm e2e:fishtilt`와 분리, ruling 108에 걸리지 않는다(서버를
띄우지 않음).

### 모두에게 — 이 문서가 확정한 규칙 다섯 줄

1. **시각 요소가 필요 없는 페이지 유형이 더 많다.** 툴 6 · 글로서리 58 · 핸드 20 · 퀴즈 4 ·
   허브 5 = **93개 페이지에 새 그림을 넣지 않는다.** 각각의 근거는 §2에 있다.
2. **화면 안 텍스트는 DOM, 화면 밖 텍스트는 `og:title`.** 그래서 이 사이트에는 사용자에게
   보이는 텍스트를 래스터에 구워야 할 자리가 **없다**(§5).
3. **alt 판정은 한 줄이다** — "이 그림을 지웠을 때 사라지는 사실이 있는가?" 없으면
   `aria-hidden`, 있으면 그 사실을 **문장으로** 쓴 `aria-label`. 매체 이름(`이미지` `차트`
   `그림`)은 금지(§6).
4. **파일명은 슬러그 기반**이고, 로케일 세그먼트는 **글자가 구워진 자산에만** 붙는다.
   `public/`에 파일이 들어가는 순간 디스크 대조 테스트를 같이 넣는다(§7).
5. **AI 생성 이미지의 판정법도 한 줄이다** — **"이 그림이 틀릴 수 있는가?"** 틀릴 수 있으면
   생성하지 마라. 권고는 **지금은 도입하지 않는 것**이고, 같은 예산을 학습 다이어그램에
   쓴다(§9).
