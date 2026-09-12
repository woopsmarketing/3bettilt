# FishTilt WP-5 — 블로그 · 썸네일 · 대표 이미지 시스템

## 목표

`/blog`는 20편이 제목·설명·"레벨 · 약 N분"만 달고 한 줄씩 나열된 목록이었고, 상세 페이지는
제목 아래 곧바로 본문이 시작됐다. MDX 113편 어디에도 이미지가 0건이었다. 이 WP는 (1) 콘텐츠
레코드가 **이미 가진 필드에서 결정적으로 생성되는** 시각 요소를 만들고, (2) 그것을 블로그
목록·상세에 넣고, (3) 본문 중간에 시각 자료를 넣을 수 있는 구조를 만들어 **실제로 쓰이는 글에
넣는다.**

하드 제약은 처음부터 두 가지였다. **이미지 파일을 한 개도 만들지 않는다**(ruling 106/114),
그리고 **텍스트를 픽셀에 굽지 않는다**(ruling 112 — 이 사이트는 다국어로 간다). 두 제약이 곧
설계다: 그림은 그리고, 글자는 DOM에 둔다.

## 범위

- **담당**: 브리프 A(썸네일 시스템) · B(`LinkCard` 확장) · C(`/blog` 목록) · D(`/blog/[slug]`
  상세) · E(본문 삽입 시각 요소) · F(문서화).
- **구속 조건**: FISHTILT_STATE ruling 100–114. 특히 **105**(날짜 금지) · **106**(레코드별
  이미지 파일이 기본이 될 수 없음) · **112**(래스터에 텍스트 금지) · **113**(다섯 번째 컨테이너
  폭은 측정 + 토큰 없이는 금지) · **114**(실제 이미지가 생기기 전에는 이미지 필드도 없다).
- **범위 밖**: 홈 · `/learn` `/glossary` `/hands` `/tools` `/practice` 허브 · 툴 페이지 ·
  `globals.css` · `routes.ts` · `src/lib/seo/**` · `src/content/types.ts`와 레지스트리 ·
  `features/tools/**`. 전부 손대지 않았다(`features/tools`는 **읽기만** 했다 —
  `formatAmountBB`를 재사용).

## 확인한 기존 상태

| 항목 | 확인한 사실 |
|---|---|
| 레코드 스키마 | `src/content/types.ts`에 **날짜 필드 0건, 이미지 필드 0건**. 있는 것: `kind` `title` `description` `level`(3종) `topic`(8종) `concepts` `readMinutes` `status` `indexable` + 관계 5종 |
| `topic` 한국어 라벨 | **존재하지 않았다.** `graph.ts`에 `LEVEL_LABEL`·`KIND_LABEL`은 있으나 `topic`은 화면에 나온 적이 없어 라벨이 없었다 |
| `/blog` 목록 카드 | 제목 · 설명 · `contentMeta`("초급 · 약 3분")뿐. 썸네일·칩 없음, 등록 순서(I1→I4) 그대로 |
| `/blog/[slug]` | 컨테이너가 `max-w-[42rem]` — **네 개 토큰에 없는 다섯 번째 폭 리터럴** |
| 상세 하단 관계 | 5개 관계가 `space-y-10` 한 덩어리. 그룹 구분 없음 |
| `LinkCard` | `visual` 슬롯이 이미 있었다(WP-2가 만들고 "WP-5 owns what goes in here"라고 적어 둠). 카드 전체가 하나의 `<a>` — 칩은 링크가 될 수 없다 |
| MDX 본문 | `<img>`/`Image`/`.png`/`.webp` **0건**. 다만 `PokerCards`(16편)·`RangeMatrixMini`(1편)는 이미 쓰이고 있었다 — 없던 것은 *이미지*가 아니라 **캡션과 `<figure>` 의미**였다 |
| `public/` | `og.png` 1개. 앱 전체 `next/image`/`<img>` 0건 |
| 블로그 20편 topic 분포 | starting-hands 7 · hand-strength 6 · odds 2 · rules/range/position/betting/equity 각 1 — **8종 전부 사용 중** |
| MDX 안전장치 | `src/content/allowList.ts`의 목록과 `content.test.ts`가 "허용되지 않은 컴포넌트를 쓴 MDX"를 막는다 |
| 검증 불가 사항 | ruling 37 — MDX는 vitest에서 렌더 불가(`.mdx` import가 Vite import-analysis에서 실패). 빌드 게이트가 유일한 보증 |

## 구현 내용

### 1. `ContentThumbnail` — 토픽 8종 × kind 4종 매핑

`topic`이 **무엇을 그릴지**, `kind`가 **무슨 색으로 그릴지** 정한다. 컴포넌트 전체가 두 개의
고정 `Record` 조회이므로 같은 레코드는 언제나 같은 그림이다(랜덤·해시·저장 자산 0).

WP-3의 `HomeHeroVisual`이 세운 선례("이 사이트가 가진 최고의 그림은 이 사이트 자신의 물건")를
카드 크기로 이어받아, 각 토픽을 **그 토픽이 다루는 물건**으로 그렸다.

| `topic` | 한국어 라벨 | 그림 | SVG 요소 | DOM 노드/개 |
|---|---|---|---|---|
| `rules` | 규칙 | 보드 5장(플랍 3장 묶음 + 턴 · 리버) + 딜러 버튼 | rect×5, rect(플랍 밑줄), circle | **11** |
| `hand-strength` | 족보 | 족보 사다리 — 아래로 갈수록 넓은(=자주 나오는) 막대 5개, 맨 위가 강조 | rect×5 | **9** |
| `starting-hands` | 시작 패 | 받은 두 장, 각각 핍 하나 | rect×2, rect×2 | **8** |
| `range` | 핸드레인지 | 격자 + **대각선 강조**(축이 랭크×랭크이므로 대각선 = 포켓페어. 구조적 사실이지 레인지 주장이 아니다) | path(격자선 전체 1개), rect×7 | **12** |
| `position` | 자리 | 테이블 타원 + 자리 6개, 내 자리 1개가 채워짐 | ellipse, circle×5, circle | **11** |
| `betting` | 베팅 | 칩 스택 3개가 점점 높아짐 | rect×3, rect×3 | **10** |
| `odds` | 확률과 오즈 | 전체 중 일부 — **정확히 4등분**한 막대의 한 칸 (임의 비율은 측정값처럼 읽히므로 균등 분할) | rect, path(구분선), rect | **7** |
| `equity` | 승률 | 원 두 개가 겹친 렌즈(두 패가 같은 팟을 두고 겹치는 몫) | circle×2, path | **7** |

| `kind` | 강조 토큰 | 왜 이 토큰인가 |
|---|---|---|
| `learn` | `act-call-500` | 퀴즈가 "정답/확인"에 쓰는 색 |
| `blog` | `brand-500` | `/blog`의 아이브로가 이미 쓰는 읽을거리 강조색 |
| `glossary` | `text-300` | 사전은 조용한 잉크 |
| `hands` | `act-raise-500` | 모든 핸드 페이지의 차트 셀 "포함" 채움색 |

**8 × 4 = 32개 조합 전부** 유닛 테스트가 렌더해 (a) 토픽 8종이 서로 다른 마크업을 내는지,
(b) kind 4종이 **색만** 바꾸고 도형은 바꾸지 않는지, (c) 노드 예산을 넘지 않는지 검사한다.

**썸네일 1개당 DOM 노드 수: 7 ~ 12개** (예산 40). 브라우저 실측(20장 평균 **8.75**). 비교:
WP-3 히어로 169. 격자선을 요소 하나씩이 아니라 `<path>` 하나로 그린 것이 가장 큰 절감이다.

색은 전부 `currentColor`로 칠하고, 색 자체는 상위 요소의 `text-*` 토큰 클래스가 정한다.
하드코딩 색 0건 — 테스트가 `#`/`rgb(`/`hsl(`를 정규식으로 막는다. `aria-hidden="true"`:
제목이 바로 옆에 텍스트로 있고 토픽은 칩으로도 나오므로 그림은 장식이다. SVG `<text>` 0건.

`size`는 `card`(16:5, 카드용)와 `hero`(24:5, 상세 상단 배너). 그림은 160×50 좌표계에 한 번만
그리고 넓은 박스에서는 **가운데로 이동**시켜(`translate(40 0)`) 레터박스가 생기지 않는다 —
같은 그림이라 클릭한 카드와 도착한 페이지가 같은 물건으로 읽힌다.

### 2. `LinkCard` 확장 (선택적 프롭 2개)

- `visual` — WP-2가 만들어 둔 슬롯을 채웠다. 프롭이 없으면 **렌더 자체를 안 한다**(빈 상자도,
  예약 높이도 없음). `/glossary`(58장) `/hands`(20장) `/tools` `/practice`는 프롭을 주지
  않으므로 마크업이 이전과 동일하다 — 테스트가 "프롭 없을 때 `<span>` 정확히 1개"로 고정.
- `chips` — 카테고리 라벨 배열. **링크가 아니라 `<span>`**이다. 카드 전체가 하나의 `<a>`라
  중첩 앵커는 불가능하고(WP-4가 같은 제약에 부딪혔다), 테스트가 "칩이 있어도 카드 안 `<a>`는
  1개"를 못 박는다. `준비 중` 카드에서도 칩과 썸네일은 그대로 나온다.
- 읽는 시간은 새 필드가 아니라 기존 `contentMeta(record)`("초급 · 약 3분")를 `meta`로 그대로
  넘겼다. 포맷 문자열을 두 번째 장소에 복제하지 않기 위해서다.

### 3. `topic` 한국어 라벨 — `src/features/content/topic.ts`

한 곳에만 둔다. `graph.ts`가 자연스러운 자리지만 `src/content/`는 이 WP의 경계 밖이고, 라벨은
그래프 구조가 아니라 표현이다. 라벨은 사이트가 이미 쓰는 말에 맞췄다 — `range → 핸드레인지`
(헤더 항목과 같은 단어, "레인지" 아님), `position → 자리`, `odds → 확률과 오즈`(정확 확률과
콜 가격을 둘 다 다루므로).

테스트가 유니온 ↔ 맵을 **양방향**으로 검사하고(누락도 잉여도 실패), 라벨 중복을 금지하고,
레지스트리의 모든 레코드가 라벨을 갖는지 확인한다.

### 4. `/blog` 목록

- 컨테이너 `max-w-reading`(48rem) → **`max-w-grid`(56rem)**. 카드 그리드용 토큰이고, 48rem에서
  2열이면 카드 하나가 22rem밖에 안 돼 썸네일·칩·제목·설명이 들어가지 않는다.
- 20편을 **토픽별로 묶었다.** 정렬 근거로 쓸 수 있는 것이 무엇인지부터 확정했다:
  - **최신순 불가** — 레코드에 날짜 필드가 없고 ruling 105가 그것을 확정했다.
  - **인기순 불가** — 분석 도구가 없다. WP-3이 홈에서 `인기 무료 도구`를 지운 것과 같은 이유.
  - **편집자 추천 순 가능하지만 검증 불가** — 아무도 확인할 수 없는 주장이 된다.
  - `topic`은 셋 중 어느 것도 아니다. 레코드가 이미 가진 닫힌 유니온이고, 그것으로 묶는 것은
    순위가 아니라 사실의 진술이다. 그래서 화면에 그렇게 적었다.
- 필터 컨트롤은 **넣지 않았다.** 20개가 스크롤로 감당되고, 클라이언트 필터는 JS·상태·빈 상태를
  더하면서 17개를 인터랙션 뒤로 숨긴다. 헤딩이 같은 일을 하고 프리렌더 HTML에 남는다.
- e2e가 지키는 계약을 유지했다: `전체 글` region **하나** 안에 그룹을 중첩했고, region 안에는
  카드 `<li>` 외의 `<li>`가 없다.

> WP-5b에서 이 그룹의 **순서와 개수**를 바꿨다. 아래 `## WP-5b 후속` 참조.

### 5. `/blog/[slug]` 상세

- `max-w-[42rem]` → **`max-w-reading`**. ruling 113이 말하는 "측정도 토큰도 없는 다섯 번째 폭"을
  제거했다.
- 헤더에 **카테고리 칩 + `contentMeta`**(레벨 · 약 N분)를 제목 바로 아래에 놓았다.
- 그 아래 **`ContentThumbnail size="hero"`** — 카드에서 본 그림의 배너 판. 제목·설명은 여전히
  DOM 텍스트다(ruling 112).
- 하단 관계 블록을 강화했다: `<aside aria-label="이 글 다음에 볼 것들">` 안에 h2 하나
  ("여기까지 읽었다면")를 두고, 5개 관계를 h3로 한 단 낮춰 **`divide-y divide-line-500`으로 서로
  분리**했다. §76의 문맥 헤딩 문장은 하나도 바꾸지 않았다 — 레벨과 구분선만 움직였다.
- `RelatedContent`의 새 `variant`는 **opt-in**이다(`plain`이 기본). `/learn` `/glossary`
  `/hands`는 경계 밖이므로 그 푸터는 1픽셀도 움직이지 않았고, 테스트가 기본값을 고정한다.

### 6. 본문 삽입 시각 요소 — `Figure` + 도메인 도형 2종

MDX가 없던 것은 이미지가 아니라 **캡션과 `<figure>` 의미**였다. 그래서:

- **`Figure`** — `<figure>` + `<figcaption>`. 표면(테두리·배경)을 **그리지 않는다**:
  `RangeMatrixMini`가 이미 `ground-800` 우물을 갖고 있어 액자를 씌우면 상자 안의 상자가 된다.
  캡션은 **children이 아니라 prop**이다 — `measureContent`가 JSX 속성을 제거하고 children은
  세므로, 캡션이 본문 길이(900자 색인 기준)나 `readMinutes`에 영향을 주지 않는다. 이 성질을
  테스트로 직접 못 박았다.
- **`OutsFigure`** — "47장 중 9장"을 47칸으로 그린다. 모수는 `outsOdds`의 `unseenCards`
  (`UNSEEN_AFTER_FLOP`/`_TURN`), 즉 **파일에 타이핑한 숫자가 아니다.** 불가능한 아웃 수는
  그럴듯한 격자를 그리는 대신 **throw**한다(규칙 5 — 프리렌더이므로 빌드 실패).
- **`PotOddsFigure`** — 최종 팟을 막대 하나로 그리고 "내 콜" 조각을 강조한다. 두 입력은
  `Money.parseBB`로 파싱(= `facts.ts`가 같은 인자를 파싱하는 방식), 나머지는 전부 `potOdds`
  출력이고 각 조각의 폭은 `Money.ratio`다. **이 파일에서 BB 산술은 일어나지 않는다**(규칙 1).

두 도형 모두 **퍼센트를 출력하지 않는다.** 본문의 `<Fact>`가 이미 그 수를 자기 반올림으로
말하고 있고, 같은 양을 두 번 렌더하는 것이 한 페이지에 한 사실의 두 숫자가 생기는 경로다.
그림의 일은 "그 숫자가 **어느** 비율인지" 보여주는 것까지다. 테스트가 `%` 미출력을 고정한다.

**실제로 넣은 글 3편** (모두 시각 자료가 0건이던 글이다):

| 글 | 넣은 것 | 그림의 출처 |
|---|---|---|
| `outs-nine` (아웃츠 9장은 무슨 뜻일까?) | `<Figure><OutsFigure outs={9} street="FLOP" /></Figure>` | `learn-core` `outsOdds` — 47칸 중 9칸 |
| `pot-odds-quick` (팟오즈 쉽게 계산하기) | `<Figure><PotOddsFigure pot="6" bet="3" /></Figure>` | `learn-core` `potOdds` + `shared` `Money` — 6+3+3=12BB 막대 |
| `why-use-range` (Range를 보는 이유) | `<Figure><RangeMatrixMini positions={['UTG','BTN']} initial="UTG" showSelection={false} /></Figure>` | `strategy-core` 실 데이터. **새 격자를 만들지 않고 기존 컴포넌트를 썼다** |

`why-use-range`는 UTG/BTN 조합 수를 문장으로 말하면서 표를 하나도 보여주지 않던 글이다. 두 번째
격자 컴포넌트를 만드는 대신 이미 검증된 `RangeMatrixMini`를 캡션과 함께 넣었다.

캡션은 그림이 주장하지 않는 것까지 적었다 — 예: `색칠된 칸이 어느 카드인지는 정해져 있지
않습니다 — 개수만 그린 그림입니다.` 보이지 않는 카드에는 순서가 없으므로 "어느 9장"은 존재하지
않는 정보다.

### 7. 나중에 사람이 만든 이미지를 넣고 싶을 때 (WP-6이 이어받을 지점)

ruling 106/114를 지키면서 authored 이미지를 넣는 경로는 **하나뿐이고 이미 열려 있다.**

1. **`LinkCard`/상세 페이지는 이미 슬롯이다.** `visual`은 `React.ReactNode`이지 `imageUrl`이
   아니다. 그래서 authored 이미지를 도입할 때 카드도 상세도 **고칠 필요가 없다** — 부모가
   `<ContentThumbnail …/>` 대신 다른 것을 넘기면 된다.
2. **레코드에 필드를 추가하는 시점은 "첫 실제 소비자가 생길 때"다**(ruling 114). 즉 순서는
   `이미지 파일 1장 존재` → `image 필드 추가` → `render 시 오버라이드`이지, 필드 먼저가 아니다.
   필드가 생기면 분기는 정확히 한 줄이다: `record.image ?? <ContentThumbnail …/>`.
3. **어떤 이미지든 텍스트가 구워져 있으면 안 된다**(ruling 112). 다국어 안전한 형태는:
   - **배경만 그림**, 제목·라벨·수치는 그 위에 **DOM 텍스트** 또는 **SVG `<text>`**로 얹는다.
   - `og:image`처럼 정말 래스터가 필요한 자리도 마찬가지다. 이 앱은 `next/og`가
     해석되지 않으므로(ruling 111과 같은 `TS2307`), 그 경로는 WP-7이 별도로 판단해야 한다.
   - 검사 방법: `ContentThumbnail.test.tsx`가 이미 `<text>` 0건과 `<img>` 0건을 고정한다. 같은
     형태의 어서션을 authored 이미지 컴포넌트에도 붙이면 된다.
4. **113장을 만들 필요는 없다.** 생성 썸네일이 기본값이고 authored 이미지는 **opt-in
   오버라이드**다. 404 표면도, 미사용 필드도 생기지 않는다.

## 변경 파일

### 신규 (12)

| 파일 | 내용 |
|---|---|
| `apps/fishtilt/src/components/ContentThumbnail.tsx` | 토픽 8종 × kind 4종 생성 썸네일 |
| `apps/fishtilt/src/components/ContentThumbnail.test.tsx` | 32조합 전수 + 노드 예산 + 토큰/장식성/`<text>` 0건 |
| `apps/fishtilt/src/components/Figure.tsx` | `<figure>`/`<figcaption>` 캡션 래퍼 |
| `apps/fishtilt/src/components/Figure.test.tsx` | 캡션 결합 · 캡션이 본문 길이에 안 잡힘 · **allow-list ↔ 주입 맵 양방향 일치** |
| `apps/fishtilt/src/components/OutsFigure.tsx` | 47/46칸 아웃츠 도형, `outsOdds` 기반 |
| `apps/fishtilt/src/components/OutsFigure.test.tsx` | 모수·강조 개수·throw 경로·퍼센트 미출력 |
| `apps/fishtilt/src/components/PotOddsFigure.tsx` | 최종 팟 막대, `potOdds` + `Money` 기반 |
| `apps/fishtilt/src/components/PotOddsFigure.test.tsx` | 폭이 `Money.ratio`와 일치 · 조각 합 = 최종 팟 · 조언 금지 |
| `apps/fishtilt/src/features/content/topic.ts` | `TOPIC_LABEL` · `topicLabel()` · `TOPIC_ORDER` |
| `apps/fishtilt/src/features/content/index.ts` | 배럴 |
| `apps/fishtilt/src/features/content/topic.test.ts` | 유니온 양방향 · 중복 금지 · 레지스트리 커버리지 |
| `apps/fishtilt/src/app/blog/[slug]/page.test.tsx` | 상세 페이지 테스트(MDX 맵만 mock — ruling 37) |

### 수정 (9)

| 파일 | 변경 |
|---|---|
| `apps/fishtilt/src/app/blog/page.tsx` | `max-w-grid`, 토픽 그룹, 썸네일·칩 전달 |
| `apps/fishtilt/src/app/blog/page.test.tsx` | 그룹 규칙 · 썸네일/칩/읽는 시간 · 정렬 주장 금지 어서션 추가 |
| `apps/fishtilt/src/app/blog/[slug]/page.tsx` | `max-w-reading`, 카테고리+시간 헤더, hero 썸네일, `<aside>` 관계 블록 |
| `apps/fishtilt/src/components/LinkCard.tsx` | `chips` 프롭 추가, `visual` 문서 갱신 |
| `apps/fishtilt/src/components/LinkCard.test.tsx` | 칩 3종 어서션 추가(기존 어서션 유지) |
| `apps/fishtilt/src/components/RelatedContent.tsx` | `variant: 'plain' \| 'sectioned'` (기본 `plain`) |
| `apps/fishtilt/src/components/RelatedContent.test.tsx` | 기본값 고정 + variant 어서션 추가 |
| `apps/fishtilt/mdx-components.tsx` | `Figure`·`OutsFigure`·`PotOddsFigure` 주입, 헤더의 **거짓 주석 정정** |
| `apps/fishtilt/tests/e2e/blog.spec.ts` | 썸네일/그룹/피겨/상세 헤더·푸터 어서션 추가 |

### 수정 — 콘텐츠 MDX (3)

`apps/fishtilt/content/blog/outs-nine.mdx` · `pot-odds-quick.mdx` · `why-use-range.mdx` —
각각 `<Figure>` 블록 1개 추가. **산문은 한 글자도 고치지 않았다**(캡션은 prop이라
`measureContent`가 세지 않으므로 `readMinutes`·`indexable` 판정이 그대로다. 레지스트리 무변경).

### 경계 밖 파일 1건 — `apps/fishtilt/src/content/allowList.ts`

**왜 불가피했나.** 이 파일은 "MDX 산문이 부를 수 있는 컴포넌트의 전부"를 고정하는 안전장치다.
MDX는 임의의 JS를 import·호출할 수 있는 Markdown 상위집합이고, 이 목록이 막는 것은 공격자가
아니라 **아키텍처 붕괴**다 — 모든 글이 아무 모듈이나 import할 수 있으면 100편이 100개의 미검토
진입점이 되고, "구조는 타입, 산문은 산문"이라는 ADR-0080의 분리가 한 달이면 사라진다.
`content.test.ts`가 모든 MDX 파일을 읽어 (a) `import`/`export`가 없고 (b) 목록 밖 컴포넌트를
부르지 않음을 강제한다.

브리프 E는 "본문 삽입 시각 요소 구조를 만들고 `mdx-components.tsx`에 등록하라"고 지시했다.
`mdx-components.tsx`에만 주입하고 `allowList.ts`에 올리지 않으면 **`content.test.ts`가 즉시
실패한다** — 즉 이 파일을 건드리지 않고 지시를 수행할 방법이 없다.

**안전장치를 약화시키지 않았음.**

1. 목록에 **3개를 추가했을 뿐, 검사 로직·강제 방식은 손대지 않았다.** 여전히 화이트리스트이고,
   여전히 `content.test.ts`가 모든 MDX를 대조하며, 여전히 `import`/`export`가 금지된다.
2. 추가한 3개는 **숫자를 그릴 수조차 없다.** `Figure`는 마크업뿐이라 아무 주장도 하지 않고,
   `OutsFigure`·`PotOddsFigure`는 자기 수치를 **주변 `<Fact>`가 읽는 것과 동일한 `learn-core`
   함수에서** 읽는다. 즉 산문은 여전히 숫자를 타이핑할 수 없고, 이제 **그릴 수도 없다.**
   목록의 목적(규칙 2)을 넓힌 것이 아니라 같은 규칙을 그림에까지 확장했다.
3. 셋 다 **실제 소비자가 있다**(위 표의 3편). 규칙 5의 미사용 스텁이 아니다.
4. **안전장치를 오히려 강화했다.** 작업 중 `mdx-components.tsx`의 헤더가 "allow-list와 주입 맵의
   일치를 `content.test.ts`가 검증한다"고 적고 있으나 **실제로는 아무도 검증하지 않고 있었다**는
   것을 발견했다. 그 구멍은 양방향으로 문다 — 목록에는 있는데 맵에 없으면 MDX가 조용히 아무것도
   렌더하지 않고, 맵에는 있는데 목록에 없으면 산문 검사가 볼 수 없는 렌더 능력이 된다.
   `Figure.test.tsx`에 **양방향 집합 일치 + `useMDXComponents`가 인자 오버라이드를 무시하는지**를
   실제 모듈로 검증하는 테스트를 추가하고, 거짓 주석을 사실대로 고쳤다. 내가 넓힌 목록을 내가
   닫았다.

### 삭제

없음. `public/`에 추가한 파일 없음(여전히 `og.png` 1개). 이미지 파일 0개. 외부 이미지 호스트 0건.

## 테스트 / 검증

| 게이트 | 결과 |
|---|---|
| `pnpm vitest run --project fishtilt --project learn-core` | **1697 / 1697 pass** (143 files). WP-4 종료 시 1643 → **+54** |
| `pnpm typecheck` | 13개 프로젝트 전부 통과, 에러 0 |
| `pnpm lint` | clean |
| `pnpm build:fishtilt` | **green**. 모든 라우트가 `○ Static` 또는 `● SSG` — **동적 라우트 0건**, `export const dynamic` 0건 |
| `pnpm e2e:fishtilt` | **253 / 253 pass**. WP-4 종료 시 240 → **+13**. 포트 3221 단독 점유, 종료 확인 |

**MDX 렌더 검증의 한계(ruling 37).** `.mdx`는 vitest에서 import되지 않는다. `/blog/[slug]`
테스트는 MDX 맵 모듈 **하나만** mock해 `.mdx`를 그래프에서 빼고, 헤더·hero·관계 푸터·컨테이너
토큰은 실제 레지스트리/그래프/컴포넌트로 검증한다. 본문이 렌더된다는 보증은 여전히
`build:fishtilt`(113편 프리렌더)이고, 새 `<Figure>` 3편이 빌드에서 초록이다.

### `/blog` DOM 노드 실측 (프로덕션 빌드, Chromium 1280px)

| | `<main>` 노드 | 문서 전체 |
|---|---|---|
| WP-5 이전 (동일 20장, 썸네일·칩·그룹 없음) | **110** | — |
| WP-5 | **385** | 465 |
| WP-5b (그룹 8→4) | **365** | **445** |

WP-5 증가분 +275의 내역(브라우저에서 실제 노드를 제거해 역산):

- 썸네일 20장 = **195** (그림 175 + 래퍼 `<span>` 20). 장당 **7~12개, 평균 8.75**
- 칩 = 40 (래퍼 20 + 라벨 20)
- 토픽 그룹 = 40 (그룹 div·SectionHeading·h3·p + `<ol>` 1개 → `<ul>` 8개)

비교: WP-3 히어로 1개가 169 노드다. 썸네일 20장 전부가 그 히어로 하나의 **1.03배**다. e2e가
장당 40 노드 상한과 그림 총합 600 미만을 페이지에서 직접 검사한다.

### 스크린샷 (다크/라이트 × 375/1280)

`wp5-blog-{dark,light}-{375,1280}.png` · `wp5-article-{dark,light}-{375,1280}.png` —
스크래치패드에만 저장. 두 테마 모두에서 썸네일·칩·피겨가 성립하고, 375px에서 가로 오버플로 0
(e2e가 360/390/768/1440에서도 검사).

## SEO/UX 관점의 영향

- **색인 대상 페이지 수·URL 구조 변화 없음.** 라우트 0개 추가, 사이트맵 130 URL 그대로.
  `routes.ts`·`src/lib/seo/**` 무변경.
- **JSON-LD 변화 없음.** ruling 107 그대로 — `datePublished`도 `aggregateRating`도 추가하지
  않았다. 애초에 레코드에 날짜가 없다.
- **`/blog` 목록의 스캔 가능성**이 실질적으로 올랐다: 20편이 4개의 이름 붙은 묶음이 되고, 각
  카드가 토픽 칩 + 레벨 + 읽는 시간을 스스로 말한다. 클릭 전에 "이게 나에게 맞는 글인가"를
  판단할 정보가 제목·설명뿐이던 상태에서 늘었다.
- **CLS 위험 없음.** 썸네일은 고정 `aspect-ratio` 박스라 레이아웃이 나중에 밀리지 않고, 외부
  요청이 0이라 늦게 도착하는 리소스가 없다.
- **추가 네트워크 요청 0.** 그림이 전부 인라인 SVG로 프리렌더 HTML 안에 있다. 이미지 0장이라
  이미지 관련 LCP·대역폭 비용이 생기지 않는다.
- **다국어 비용 0.** 화면의 모든 글자가 DOM 텍스트이므로 로케일 추가 시 재생성할 이미지가
  없다(ruling 112가 요구한 성질).
- **접근성:** 썸네일은 `aria-hidden` 장식, 두 도형은 개수·금액을 말로도 적어 색만으로 전달되는
  정보가 없다(WCAG 1.4.1). 상세 하단 관계 블록이 `<aside>`가 되어 건너뛰기가 쉬워졌고, 헤딩
  레벨이 h1 → h2 → h3로 정돈됐다.

## 남은 이슈

1. **`/learn` 허브 썸네일은 켜지 않았다 — 켜기를 권고한다(단, 이 WP에서 하지 않았다).**
   근거: 시스템이 이미 `kind: 'learn'`을 지원하고(`act-call-500` 강조), 15개 레슨은 topic이
   6종에 걸쳐 있어 그림이 구별된다. 비용은 카드당 8~9 노드, 15장이면 약 135 노드다. 다만 `/learn`
   허브는 이 WP의 경계 밖이고, 그 페이지는 **커리큘럼 순서와 번호(eyebrow)**가 이미 강한 시각
   구조를 갖고 있어 썸네일이 그것과 경쟁할 수 있다 — 목록이 "순서대로 읽는 것"인지 "골라 읽는
   것"인지에 대한 판단이 필요하다. `/glossary`(58장)와 `/hands`(20장)는 **권고하지 않는다**:
   둘 다 훑어보는 색인이고, 58장에 썸네일을 달면 밀도가 무너진다.
2. **`og:image`는 여전히 `public/og.png` 한 장으로 전 페이지 공용이다.** 페이지별 OG 이미지는
   `next/og`가 이 앱에서 해석되지 않으므로(ruling 111과 같은 `TS2307`) 별도 판단이 필요하다.
   WP-7 소관. ruling 112 때문에 "제목을 구운 OG 이미지"는 어차피 선택지가 아니다.
3. **`ContentThumbnail`은 `level`을 쓰지 않는다.** 브리프는 `kind` `topic` `level` `title`을
   재료로 허용했지만, 4종 kind × 8종 topic으로 이미 32개 조합이고 여기에 3종 level을 곱하면
   96개가 된다 — 사람이 구별할 수 없는 차이는 신호가 아니라 소음이다. level은 카드의
   `contentMeta`가 텍스트로 말한다.
4. **`OutsFigure`가 강조하는 9칸은 읽기 순서상 앞의 9칸이다.** 보이지 않는 카드에는 순서가 없어
   "옳은 9장"이 존재하지 않으므로 어떤 선택이든 임의적이다. 캡션이 이 사실을 명시한다.
5. **`Figure`는 `RelatedContent`처럼 `/learn` 본문에도 쓸 수 있지만 쓰지 않았다.** 레슨 15편은
   이 WP의 경계 밖이다. 구조는 열려 있다.

## 다음 WP에 넘길 사실 요약

- **썸네일은 `topic`(그림) × `kind`(색)의 순수 함수다.** 저장 자산 0, 랜덤 0, 이미지 필드 0.
  장당 7~12 DOM 노드. 새 토픽이 `types.ts`에 추가되면 `TOPIC_ART`가 **타입 에러**를 낸다.
- **`LinkCard`는 `visual`과 `chips` 두 선택 슬롯을 갖는다.** 프롭을 주지 않으면 마크업이
  이전과 동일하다 — 다른 허브는 안전하게 그대로다. 카드는 여전히 하나의 `<a>`이므로 **칩은
  절대 링크가 될 수 없다.**
- **`topic`의 한국어 라벨은 `src/features/content/topic.ts` 한 곳에만 있다.** 다른 곳에서 토픽
  이름을 문자열로 적지 마라.
- **MDX allow-list는 이제 10개**이고, **allow-list ↔ 주입 맵의 양방향 일치를
  `src/components/Figure.test.tsx`가 검증한다**(이전에는 아무도 검증하지 않았다). MDX 컴포넌트를
  추가하려면 두 곳을 모두 고쳐야 한다.
- **캡션은 prop이지 children이 아니다.** `measureContent`가 속성을 제거하므로 캡션은 본문 길이에
  잡히지 않는다. 이 성질에 기대어 발행된 글에 그림을 추가해도 `readMinutes`·`indexable`이 움직이지
  않는다 — children으로 바꾸면 레지스트리가 깨진다.
- **authored 이미지 도입 경로는 이미 열려 있다**(위 §7): 슬롯은 `React.ReactNode`이므로 카드도
  상세도 고칠 필요가 없고, 레코드 필드는 **첫 실제 이미지가 생긴 뒤에** 추가하며(ruling 114),
  어떤 이미지에도 글자를 굽지 않는다(ruling 112).
- **`/blog/[slug]`의 다섯 번째 컨테이너 폭 리터럴(`max-w-[42rem]`)은 제거됐다.** 남아 있는
  `max-w-[42rem]`은 `PageHero`와 `SectionHeading`의 **설명문 prose measure**로, 페이지 컨테이너가
  아니다(ruling 113의 대상이 아니지만, 정리하려면 그 두 컴포넌트의 소유자가 판단할 일이다).
- **e2e `blog.spec.ts`는 이제 20장 썸네일의 노드 예산을 페이지에서 직접 잰다.** 카드에 무거운
  것을 넣으면 그 테스트가 먼저 실패한다.

---

## WP-5b 후속

### 문제 (1280px 실측)

WP-5의 첫 판은 그룹을 `TOPIC_ORDER`(유니온 선언 순서)로 렌더했다. 안정적이고 아무 주장도 하지
않는 순서였지만, 빌드된 페이지에서 재면 `/blog`가 **`규칙 · 1편`으로 시작했다** — 2열 그리드에
카드 한 장, 옆은 빈 반 칸, 그 아래 있는 `족보 6편`은 스크롤 밖. 첫 화면에 카드가 **1장**이었다.
부차적으로 20편에 그룹 헤더가 8개라 헤더가 콘텐츠보다 많아 보이는 구간이 생겼다.

정렬 근거는 정직했는데 첫인상이 틀렸다.

### 고친 것 — 두 가지, 둘 다 여전히 "주장이 아닌 사실"

1. **그룹을 편수 내림차순으로 정렬한다**(동수는 `TOPIC_ORDER`로 결정적 tie-break).
   편수는 순위가 아니다. "이 주제에 대해 얼마나 썼는가"이지 그 주제가 더 좋다/새롭다/많이
   읽힌다는 말이 아니다. 그리고 **각 헤딩이 자기 편수를 인쇄하므로 독자가 순서를 페이지에서
   직접 검산할 수 있다** — 아무도 확인할 수 없는 편집 순서와 갈리는 지점이 정확히 이것이다.
2. **자기 헤딩을 가지려면 최소 2편이 필요하다**(`MIN_GROUP_ARTICLES = 2`). 2열 그리드에서 1편
   그룹은 반 칸이 빈 줄이고, 그것은 카테고리가 아니라 **로딩 실패처럼** 읽힌다. 기준 미달 토픽은
   마지막 한 묶음 **`한 편씩 있는 주제`**로 모은다 — 헤딩 자체가 다시 편수 진술이고, 각 카드는
   여전히 자기 토픽 칩을 달고 있어 잃는 정보가 없다.

추가 안전장치: **카드가 1장인 그룹은 2열이 아니라 1열로 렌더한다.** 임계값이 못 잡는 미래의
분포에서도 빈 반 칸이 다시 나올 수 없다.

### 결과

| | WP-5 | WP-5b |
|---|---|---|
| 그룹 개수 | 8 | **4** |
| 첫 그룹 | `규칙 · 1편` | **`시작 패 · 7편`** |
| 첫 화면(1280×900) 카드 수 | 1 | **4** |
| 그룹 구성 | 선언 순서 8개 | 시작 패 7 · 족보 6 · 확률과 오즈 2 · 한 편씩 있는 주제 5 |
| `<main>` DOM 노드 | 385 | **365** |

### 화면에 적은 정렬 근거

> 전체 20편 중 20편을 읽을 수 있습니다. 나머지는 준비 중입니다. **아래는 주제별로 묶었고, 글이
> 여러 편인 주제부터 편수가 많은 순으로 나옵니다. 묶음 안의 순서는 순위가 아닙니다.**

기존의 정직한 안내(`묶음 안의 순서는 순위가 아닙니다`)를 지우지 않고, 바뀐 정렬 방식을 사실대로
덧붙였다. 인기·최신·추천을 주장하는 단어는 여전히 0건이고, 유닛·e2e 양쪽이 그 6개 문구
(`최신순` `인기순` `인기 글` `많이 읽은` `새 글` `신규`)의 부재를 계속 검사한다.

### 테스트 — 어서션을 지운 것이 아니라 규칙이 두 갈래가 되어 둘 다 못 박았다

WP-5의 두 어서션("헤딩은 `TOPIC_ORDER` 순", "모든 `<ul>`은 단일 토픽")은 바뀐 규칙과 맞지 않게
됐다. 삭제하거나 느슨하게 하는 대신 **강화**했다:

- 이름 붙은 그룹은 **단일 토픽이면서 2편 이상**이다(전에는 단일 토픽만).
- 토픽이 섞이는 그룹은 **remainder 하나뿐이고, 그 안의 모든 토픽은 정확히 1편**이다 —
  헤딩이 하는 주장 그 자체를 검사한다.
- 이름 붙은 그룹의 편수는 **내림차순**이다.
- **첫 그룹은 카드가 2장 이상**이다(측정된 결함을 직접 막는 어서션).
- 모든 글이 정확히 한 그룹에 정확히 한 번 나온다.
- 각 헤딩이 자기 편수를 인쇄한다(= 정렬 근거가 페이지에서 검산 가능).

그룹 블록을 DOM 구조 추측이 아니라 `data-group`으로 찾도록 바꿨다 — 구조 추측으로만 확인할 수
있는 주장은 조용히 확인되지 않게 된다.

| 게이트 | 결과 |
|---|---|
| `pnpm vitest run --project fishtilt --project learn-core` | **1697 / 1697** (WP-5 1694 → +3) |
| `pnpm typecheck` · `pnpm lint` | clean |
| `pnpm build:fishtilt` | green, 동적 라우트 0건 |
| `pnpm e2e:fishtilt` | **253 / 253** |
| 스크린샷 | `wp5b-blog-{dark,light}-1280.png` · `wp5b-blog-dark-375.png` · `wp5b-blog-remainder-{dark,light}-1280.png` |

`ContentThumbnail` · `LinkCard` · `/blog/[slug]` · MDX 3편 · `allowList.ts`는 **손대지 않았다.**
변경 파일은 `src/app/blog/page.tsx`, `src/app/blog/page.test.tsx`, `tests/e2e/blog.spec.ts` 3개다.
새 컨테이너 폭 0, 새 색 0.
