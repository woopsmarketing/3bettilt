# FishTilt WP-2 — 디자인 시스템 · 테마 · 공통 레이아웃

## 목표

"화면이 밋밋하고 가독성·친근함이 아쉽다"를 토큰 층에서 고친다. 구체적으로 (1) 색상만 있던
디자인 토큰에 표면 층·타이포 스케일·radius·컨테이너 폭·그림자를 추가하고, (2) 같은 토큰
**이름의 값만** 바꾸는 방식으로 라이트 테마를 만들고, (3) FOUC 없는 테마 토글을 헤더에 넣고,
(4) 헤더에 `/blog`와 active state를 넣고, (5) 허브 6곳이 각자 재구현하던 카드를 하나로 뽑고,
(6) 파비콘을 추가한다.

MVP가 세운 정확성·정직성·접근성 보증은 하나도 낮추지 않는다. 특히 **두 테마 모두 WCAG AA**가
하드 제약이었다.

## 범위

- **담당**: WP-1 감사 §6의 우선순위 2(헤더 `/blog`), 3(파비콘), 11(nav active state),
  12(공통 `LinkCard`), 13(라이트 모드).
- **구속 조건**: FISHTILT_STATE ruling 100–112. 특히 103(토큰 재정의 방식, 이름 변경 금지),
  104(액션 채움 위 잉크 토큰 분리 + 두 테마 대비 assertion), 108(build/e2e 직렬화),
  111(시스템 폰트 스택 + 한글 페이스 명시), 112(래스터에 텍스트 굽지 않기).
- **범위 밖**: 콘텐츠(MDX)·레지스트리·`src/lib/seo/**`·홈(`src/app/page.tsx`)·툴 상세 페이지.
  손대지 않았고, 필요한 것은 §남은 이슈에 적었다.

## 확인한 기존 상태

| 항목 | 확인한 사실 |
|---|---|
| 토큰 | `globals.css`의 `@theme`에 색상 15개 + 폰트 2개뿐. spacing/radius/타이포/컨테이너 토큰 없음 |
| 토큰 이탈 | 비테스트 `.tsx` 전체에서 단 1건 — `Term.tsx`의 `backdrop:bg-black/60`. 작업 후 0건 |
| Tailwind v4 동작 | **실측**: `@theme`는 `@layer theme` 안의 `:root, :host`로 변수를 방출하고 유틸리티는 `var(--color-…)`를 유지한다. 따라서 `:root[data-theme='…']` 오버라이드가 실제로 먹는다 |
| Tailwind v4 예외 | **`--shadow-*`만 유틸리티에 값이 인라인된다.** `--shadow-raised`를 테마별로 재정의해도 효과가 없어서 색을 내부 `var()`로 한 번 더 감쌌다 (§구현 내용 6) |
| 헤더 | `PRIMARY_NAV_IDS` 5개, `blog` 없음. `usePathname`/`aria-current` 0건 |
| `next/navigation` | **해석된다** (`next/navigation.js`, 이미 4개 동적 라우트가 `notFound`를 이렇게 import 중). `next/link`·`next/font`·`next/og`만 `TS2307` |
| 카드 | `HomeLinkCard`가 홈 전용, 허브 6곳이 className 문자열까지 동일한 마크업을 각자 재구현 |
| `FOOTER_NAV_IDS` | `[...PRIMARY_NAV_IDS, 'blog', 'hands', 'about']` — `blog` 승격 시 푸터에 중복 렌더될 구조였다 |
| 파비콘 | 없음. `public/`에 `og.png` 1개 |

## 구현 내용

### 1. 최종 토큰 표 (다음 WP 전부가 참조하는 표)

색상 토큰은 **역할 이름**이고 밝기 이름이 아니다. 그래서 두 테마에서 같은 이름이 그대로 쓰인다.
★ = WP-2 신규.

| 토큰 | 역할 | 다크 | 라이트 |
|---|---|---|---|
| `--color-ground-900` | 페이지 바탕 | `#090a0d` | `#f2f4f7` |
| `--color-ground-800` | **우물(recessed)** — 카드 안의 결과 상자 | `#101319` ⟵`#0e1014` | `#ecf0f5` |
| `--color-panel-700` | **카드** — 기본 컨테이너(`Panel`, `LinkCard`) | `#171b21` ⟵`#13161b` | `#ffffff` |
| `--color-panel-600` | **중첩·부유** — 카드 속 카드, 팝오버, 중립 셀 | `#1b1f26` ⟵`#191d23` | `#f6f8fb` |
| `--color-line-500` | 유일한 테두리·구분선 | `#616c7a` ⟵`#5c6774` | `#808a96` |
| `--color-text-100` | 본문 잉크 | `#f5f6f7` | `#10141a` |
| `--color-text-300` | 보조 잉크(설명·메타) | `#9aa1ac` ⟵`#969da8` | `#566070` |
| `--color-text-500` | 조용한 잉크 — **large/UI 전용, 본문 금지** | `#6b7380` ⟵`#656c77` | `#767e8b` |
| `--color-brand-500` | 브랜드 **잉크** (링크·아이브로·active nav) | `#ff334d` | `#c2183a` |
| `--color-brand-600` | 브랜드 **채움** (버튼·선택 셀) | `#d71e36` | `#a01230` |
| `--color-brand-950` | 브랜드 최심 틴트 (현재 사용처 없음) | `#3a1118` | `#ffe4e8` |
| `--color-suit-red-500` | 하트·다이아 잉크 (`PokerCard`) | `#ff4d63` | `#c62b23` |
| `--color-act-raise-500` | 레인지 포함 채움 | `#e4572e` | `#c0410f` |
| `--color-act-call-500` | 정답 테두리 · 레인지 차이 채움 | `#2ba3a3` | `#17706f` |
| `--color-act-fold-500` | 레인지 밖 채움 (**채움 전용**) | `#3a414d` | `#c3cad4` |
| ★ `--color-ink-on-action` | 액션 **채움 위** 잉크 | `#0b0d10` | `#ffffff` |
| ★ `--color-ink-on-brand` | 브랜드 **채움 위** 잉크 | `#ffffff` | `#ffffff` |
| ★ `--color-scrim-900` | 팝오버 백드롭 | `rgb(0 0 0 / .66)` | `rgb(9 12 18 / .44)` |
| ★ `--ft-shadow-cast` / `--ft-shadow-edge` | 그림자 색(비토큰, 유틸리티 생성 안 함) | `rgb(0 0 0 / .75)` / `/.4` | `rgb(16 20 26 / .22)` / `/.06` |

다크값이 바뀐 것은 표면 4개 + `line-500` + `text-300` + `text-500`뿐이다. **브랜드 레드
`#ff334d`, 모든 `act-*`, `suit-red-500`, `text-100`, `ground-900`은 그대로**다 — 정체성은
건드리지 않았다.

**비색상 토큰(★ 전부 신규)**

| 토큰 | 값 | 왜 |
|---|---|---|
| `--text-{xs,sm,base,lg,xl,2xl,3xl,4xl}--line-height` | `1.6 / 1.75 / 1.8 / 1.65 / 1.5 / 1.4 / 1.32 / 1.22` | 한글은 라틴 기본값(1.5)보다 큰 행간이 필요하다. 기존에는 컴포넌트마다 `leading-[1.8]`을 손으로 적었고 MDX 본문은 1.5로 남아 있었다. 크기 스케일은 Tailwind 기본 유지 — 문제는 크기가 아니라 행간이었다 |
| `--radius-{sm,md,lg,xl}` | `0.3125 / 0.5 / 0.75 / 1rem` | 전 단계 한 칸씩 부드럽게. 컴포넌트 수정 0으로 카드·버튼·배지 기하가 동시에 바뀌는 가장 싼 "친근함" 레버 |
| `--container-reading` | `48rem` | 산문·1열 목록. 기본 크기에서 한글 약 48자/줄 |
| `--container-grid` | `56rem` | 2열 카드 그리드·표 |
| `--container-shell` | `72rem` | 헤더·푸터 바 |
| `--spacing-section` | `3.5rem` | 페이지 최상위 섹션 사이 리듬 (`mt-section`) |
| `--shadow-raised` | `0 18px 40px -12px var(--ft-shadow-cast), 0 0 0 1px var(--ft-shadow-edge)` | **유일한** 그림자. 다크에서 그림자는 거의 안 보이므로 층은 표면+보더가 담당하고, 진짜로 페이지 위에 떠 있는 것(`Term` 팝오버)만 그림자를 얻는다 |
| `--font-sans` | `ui-sans-serif, system-ui, -apple-system, 'Apple SD Gothic Neo', 'Segoe UI', 'Malgun Gothic', Roboto, 'Helvetica Neue', sans-serif` | ruling 111. 웹폰트 파일 0개, `@font-face` 0개. 한글 페이스를 **명시**하고 나머지는 제네릭 유지 |

**상태색(성공/경고/정보)은 추가하지 않았다.** 실제 사용처를 조사한 결과 "정답" 표시는 이미
`act-call-500`(`MiniQuiz.tsx:104`, `QuizQuestionCard.tsx:87`)이 담당하고 있고, 경고/정보 계열은
사용처가 0건이다. 사용처 없는 토큰은 만들지 않았다.

### 2. 표면 층(elevation) 정리 — "밋밋함"의 직접 원인

기존 `panel-700`은 `ground-900` 대비 **1.06:1**이었다. 즉 카드는 보더 하나였고 표면이 아니었다.
카드/페이지 대비를 **1.15:1**(다크) / **1.10:1**(라이트)로 벌리고, 4개 표면에 "얼마나 떠 있는가"
기준의 역할 이름을 문서화했다:

```
ground-900  페이지          ground-800  우물(패임)
panel-700   카드            panel-600   중첩·부유
```

다크에서는 위로 갈수록 밝아지고, 라이트에서는 카드가 흰색이고 그 주위 페이지가 톤 다운된다.
같은 이름이 두 테마에서 그대로 성립하는 이유다. `theme-tokens.test.ts`가 이 델타의 하한
(1.08:1)을 두 테마 모두에서 지킨다.

### 3. 테마 구조

`globals.css`에 정확히 지시받은 4단 구조로 넣었다.

```
@theme                                        → 다크(기본, 사이트 정체성)
@media (prefers-color-scheme: light)
  :root:not([data-theme='dark'])              → 저장된 선택이 없고 OS가 라이트일 때(JS 없는 방문자 포함)
:root[data-theme='light'] / [data-theme='dark'] → 명시적 선택이 양방향으로 이긴다
```

`color-scheme`도 각 블록에서 같이 선언해 폼 컨트롤·스크롤바·페이지 뒤 캔버스가 팔레트를 따른다.

**FOUC 없음.** `layout.tsx`의 `<head>`에 blocking 인라인 스크립트를 넣어 첫 페인트 전에
`document.documentElement.dataset.theme`을 확정한다. `try/catch`로 감쌌고(프라이빗 모드에서
`localStorage` 접근 자체가 throw한다), **명시적 선택만** 스탬프한다 — 저장된 것이 없으면
`data-theme`을 아예 안 붙여서 결정권이 `prefers-color-scheme`으로 넘어간다. `<html>`에
`suppressHydrationWarning`.

**빌드 산출 CSS로 직접 확인했다**(`.next/static/chunks/*.css`):
`.bg-panel-700{background-color:var(--color-panel-700)}`이고
`:root[data-theme=light]{…--color-panel-700:#fff;…}`가 실제로 존재한다. 즉 오버라이드가 먹는다.

### 4. 라이트 모드에서 별도 처리해야 했던 3곳

**(a) 액션 채움 위의 잉크 — ruling 104.**
`RangeMatrix.tsx:104`, `RangeCompareMatrix.tsx:68,79`, 그리고 감사에 없던 범례 스와치
(`RangeCompareMatrix.tsx:153`)가 `text-ground-900`/`bg-ground-900`, 즉 **페이지 색을 잉크로**
쓰고 있었다. 토큰을 반전시키면 주황 채움 위에 흰 글자가 올라간다. `--color-ink-on-action`으로
분리했고, 두 테마 모두 대비를 `theme-tokens.test.ts`가 계산해 검증한다(5.28 / 5.24, 6.37 / 5.86).

여기서 **`act-*` 채움 자체도 라이트 값을 가져야 했다.** 이유는 물리적이다 —
`act-raise-500`은 채움일 뿐 아니라 **텍스트 색**으로도 쓰인다(`SelectedHandPanel.tsx:76`,
`RangeShareLink.tsx:98`). 흰 배경 위 본문 4.5:1은 상대휘도 ≤0.162를, 검은 잉크를 받는 채움은
≥0.206을 요구한다. 한 값이 둘 다 만족할 수 없다. 브리프의 "테마와 무관하게 고정" 문구를 문자
그대로 지키면 라이트 모드에서 그 두 곳이 3.68:1이 되어 **하드 제약 9(두 테마 AA)**를 어긴다.
그래서 `ink-on-action`을 "페이지 색을 따라가지 않는 전용 잉크 토큰"으로 해석하고 테마별 감사값을
줬다. 두 테마 모두 assertion이 걸려 있어 의도는 그대로 보존된다.

**(b) 브랜드 채움 위의 잉크 — 감사에 없던, 더 큰 건.**
`bg-brand-600 text-text-100`이 **11개 컴포넌트 17곳**에 있다. `text-100`은 *페이지* 잉크이고
라이트에서는 거의 검정이므로, 그대로 두면 사이트의 모든 기본 버튼이 짙은 빨강 위 검정 글씨
(3.6:1)가 된다. 구조적으로 옳은 수정은 각 호출부를 `text-ink-on-brand`로 바꾸는 것인데,
그중 **11개 파일이 WP-2 경계 밖**이다.

경계 안에서 해결했다 — 채움이 자기 서브트리에 대해 잉크 토큰을 다시 가리키게 한다:

```css
.bg-brand-600 { --color-text-100: var(--color-ink-on-brand); }
```

`globals.css` 한 파일의 한 규칙이고, 나중에 호출부가 `text-ink-on-brand`로 옮겨가면 그대로
지우면 된다. Tailwind 유틸리티는 `@layer utilities`에 있고 이 규칙은 레이어 밖이라 확실히 이긴다.
실제 브라우저에서 라이트 모드 버튼 대비를 측정하는 e2e가 붙어 있다.

**(c) 팝오버 백드롭.** `bg-black/60` → `bg-scrim-900`. 흰 페이지 위 60% 검정은 무거운 회색
얼룩이고, 다크 페이지에서는 거의 불투명해야 분리된다. 값이 팔레트 옆으로 왔다.
`::backdrop`이 최근에야 originating element로부터 커스텀 속성을 상속하기 시작했으므로
`::backdrop`에도 변수를 직접 선언하는 4줄짜리 안전망을 같이 넣었다.

**13×13 표 확인(필수 항목).** 실제 브라우저에서 계산된 스타일로 두 테마 모두 측정했다 —
포함 셀 라벨 대비, 제외 셀 라벨 대비, 그리고 포함/제외 **채움끼리의** 분리도. 라이트에서
포함/제외 분리는 **3.18:1**로 다크(2.79:1)보다 오히려 낫다. 스크린샷으로도 눈으로 확인했다.

### 5. 테마 토글 (`ThemeToggle.tsx`, 신규)

- 진짜 `<button>`, 44×44, `focus-visible` 링, 헤더 상단 바(검색 아이콘 옆)에 상주. 모바일
  패널에 복제하지 않았다 — 360px에서도 검색 옆에 들어가고, 한 설정에 컨트롤 두 개는 나쁘다.
- **하이드레이션 불일치 없음**: 해·달 아이콘을 **둘 다** 렌더하고 `globals.css`의
  `.theme-only-dark` / `.theme-only-light`가 팔레트와 동일한 3단 cascade로 하나만 보여준다.
  이 사이트는 풀 페이지 로드로 이동하므로 상태로 아이콘을 고르면 매 페이지 첫 페인트마다 어긋난다.
- **접근 이름은 "누르면 무엇이 되는지"**: `밝은 테마로 바꾸기` / `어두운 테마로 바꾸기`.
  서버는 방문자의 선택을 알 수 없으므로 SSR 값은 방향 중립 `테마 바꾸기`이고, 마운트 직후
  구체적 문장으로 바뀐다(그 전에는 클릭 핸들러도 없다).
- `localStorage`에 저장 → 다음 방문·다른 페이지에서 유지. `setItem`이 throw해도 테마는 바뀌고
  기억만 안 된다.
- OS 선호가 바뀌면(명시 선택이 없을 때만) 라벨도 따라간다 — `matchMedia` 리스너.

### 6. 그림자가 테마를 따르게 만든 부분

빌드 산출 CSS를 보고 발견한 것: Tailwind는 `--shadow-*` 테마 값을 유틸리티에 **인라인**한다.
그래서 `--shadow-raised`를 테마 블록에서 재정의해도 아무 일도 일어나지 않는다. 색을 내부
`var(--ft-shadow-cast/edge)`로 한 겹 감싸면 유틸리티가 그 `var()`를 그대로 보존해 사용 시점에
해석된다. `--ft-*`는 `@theme` 밖에 둬서 쓸모없는 유틸리티를 만들지 않는다. 이 간접 참조를 누가
"단순화"하지 못하도록 테스트가 걸려 있다.

### 7. 헤더

- `PRIMARY_NAV_IDS`에 `'blog'` 추가(ruling 102) → **배우기 · 핸드레인지 · 무료 도구 · 퀴즈 ·
  블로그 · 포커 용어** 6개 + 검색 + 테마 토글. `hands`/`about`은 푸터 유지(ruling 102).
- `FOOTER_NAV_IDS`가 `[...PRIMARY_NAV_IDS, 'blog', …]`였으므로 `'blog'` 리터럴을 빼야 했다.
  안 뺐으면 푸터에 블로그가 두 번 렌더된다. (한 줄 타겟 수정 2건 + 주석 갱신. 파일 재정렬 없음.)
- **active state**: `usePathname`(`next/navigation.js` — 이 앱에서 해석된다)로 현재 경로를 읽고
  `activeNavId()`가 **가장 긴 일치**를 고른다. `/tools/range`에서 `/tools`와 `/tools/range`가
  동시에 켜지지 않고, 세그먼트 경계를 요구해 `/toolsomething`은 `/tools`에 걸리지 않으며,
  `/`는 정확 일치일 때만(워드마크가 받는다). 정적 프리렌더 중 Next가 템플릿
  (`/blog/[slug]`)을 보고해도 같은 답이 나와 하이드레이션 시 마크업이 바뀌지 않는다.
  표시는 `aria-current="page"` + 브랜드 색 + **밑줄**(색만으로 전달하지 않는다, WCAG 1.4.1).
- 데스크톱 6개 + 검색 + 토글이 겹치지 않는지: 기존 responsive e2e의 `scrollWidth` 검사가
  768/1024/1280/1440px에서 통과한다. nav에 `whitespace-nowrap`을 걸어 라벨이 줄바꿈으로
  오버플로를 감추지 못하게 했다 — 그래야 그 e2e가 진짜 게이트가 된다.
- 정적 렌더 유지: `usePathname`은 `useSearchParams`와 달리 동적 렌더링을 강제하지 않는다.
  빌드 결과 131개 페이지 전부 여전히 정적이다.

### 8. 공통 카드 (`LinkCard.tsx`, 신규)

허브 6곳 + 홈이 같은 카드를 7번 재구현하고 있었다(“준비 중” 정직성 분기까지 6번 복제).
하나로 뽑고 6곳을 교체했다. **카피는 한 글자도 바꾸지 않았다.**

- 프롭: `href: string | null`(호출부가 `hrefOfContent`/레지스트리 `available`로 이미 해석해서
  넘긴다 — 카드는 절대 경로를 만들지 않는다), `title`, `description`, `meta`, `eyebrow`,
  `visual`, `density`, `className`.
- `visual`은 **WP-5용 슬롯**이다. 아무것도 안 넘기면 아무것도 렌더하지 않는다 — 플레이스홀더
  상자도, 예약 높이도 없다. 113장 카드에 빈 상자가 생기는 편이 썸네일이 없는 것보다 나쁘다.
  `ContentRecord`에 이미지 필드가 없고 ruling 112가 "텍스트는 픽셀이 아니라 DOM"으로 정리했으므로
  `imageUrl`이 아니라 슬롯이다.
- `density`: `comfortable`(p-5, 읽는 허브 — learn/blog/tools/practice) vs `compact`(p-4, 훑는
  2열 색인 — glossary/hands).
- **`HomeLinkCard`는 `LinkCard`의 별칭이 되었다**(`export { LinkCard as HomeLinkCard }`).
  두 번째 시스템을 만들지 않기 위해서다. `src/app/page.tsx`가 WP-3 소유라 import를 바꿀 수 없어서
  이름만 남겼고, WP-3이 홈을 다시 만들 때 `LinkCard`를 직접 import하고 이 파일을 지우면 된다.
  `LinkCard.test.tsx`가 `HomeLinkCard === LinkCard`를 assert한다.
- learn 허브의 레슨 번호는 카드 내부 전용 레이아웃(baseline 행 + 모든 줄에 `pl-9`)이었는데
  공통 eyebrow로 바꿨다. 숫자·순서·읽는 순서는 같다.
- hands 허브의 핸드 키도 eyebrow로. ADR-0053대로 표기는 그대로다.

### 9. 레이아웃 · 읽기 폭

| 허브 | 이전 | 이후 | 왜 |
|---|---|---|---|
| `/learn` `/blog` | `max-w-3xl` | `max-w-reading` (48rem) | 값 동일, 이름만 역할로 |
| `/glossary` `/hands` | `max-w-3xl` | `max-w-grid` (56rem) | 2열 그리드인데 1열 산문 폭이었다 |
| `/tools` `/practice` | `max-w-4xl` | `max-w-grid` (56rem) | 값 동일, 이름만 역할로 |
| 헤더 | `max-w-6xl` | `max-w-shell` (72rem) | 값 동일 |

섹션 간격은 `mt-14` → `mt-section`(같은 3.5rem), 페이지 패딩은 `py-16` → `py-14 sm:py-20`.

프리미티브는 새로 만들지 않고 정리했다:
- `PageHero`: h1 `text-3xl` → `text-3xl sm:text-4xl` + `tracking-[-0.01em]`. 1280px에서 30px h1은
  그 아래 20px 이하와 위계가 서지 않았다. 폰에서는 30px 유지(36px 한글 줄은 너무 일찍 접힌다).
  description에 `max-w-[42rem]` 산문 폭.
- `SectionHeading`: h2 `text-lg` → `text-xl`. 카드 제목과 구분되는 최소 크기. h3는 `text-base`.
- `Panel`: 마크업 그대로, 표면 사다리 문서화만.

### 10. 파비콘

`src/app/icon.svg` — 브랜드 레드 라운드 스퀘어 위에 흰 대각선 3칸 + 흐린 상삼각 3칸.
사이트의 핵심 오브젝트인 13×13 표의 축약이고, 자체 배경이 있어 밝은 탭·어두운 탭 양쪽에서 보인다.
Next의 app-dir 파일 컨벤션이라 `metadata.icons`를 손으로 쓰지 않았다. e2e가 `/icon.svg`가
`image/svg+xml`로 200을 주고 페이지가 그것을 링크하는지 확인한다.

## 변경 파일

### 신규 (7)

| 파일 | 내용 |
|---|---|
| `apps/fishtilt/src/app/icon.svg` | 파비콘 |
| `apps/fishtilt/src/app/theme-tokens.test.ts` | `globals.css`를 파싱해 두 테마 대비를 전부 재계산 + 테마 구조 검증 (74 tests) |
| `apps/fishtilt/src/components/ThemeToggle.tsx` | 테마 토글 |
| `apps/fishtilt/src/components/ThemeToggle.test.tsx` | 8 tests |
| `apps/fishtilt/src/components/LinkCard.tsx` | 공통 카드 |
| `apps/fishtilt/src/components/LinkCard.test.tsx` | 11 tests |
| `apps/fishtilt/tests/e2e/theme-and-header.spec.ts` | 테마·헤더·13×13·파비콘 브라우저 검증 (15 tests) |

### 수정 (24)

| 파일 | 무엇을 |
|---|---|
| `apps/fishtilt/src/app/globals.css` | 토큰 전면 재구성, 3단 테마 블록, `::backdrop` 안전망, `.theme-only-*`, `.bg-brand-600` 잉크 규칙, 대비 감사 주석 갱신 |
| `apps/fishtilt/src/app/layout.tsx` | `<head>` FOUC 방지 스크립트, `suppressHydrationWarning` |
| `apps/fishtilt/src/app/blog/page.tsx` | `LinkCard` 교체, 컨테이너/리듬 토큰화 |
| `apps/fishtilt/src/app/learn/page.tsx` | 동일 (+ 번호를 eyebrow로) |
| `apps/fishtilt/src/app/glossary/page.tsx` | 동일 (+ `density="compact"`, `max-w-grid`) |
| `apps/fishtilt/src/app/hands/page.tsx` | 동일 (+ 핸드 키를 eyebrow로, `max-w-grid`) |
| `apps/fishtilt/src/app/tools/page.tsx` | `ToolCard`를 `LinkCard` 위임으로 축소 |
| `apps/fishtilt/src/app/practice/page.tsx` | `PracticeQuizCard`를 `LinkCard` 위임으로 축소 |
| `apps/fishtilt/src/components/SiteHeader.tsx` | `usePathname` + `activeNavId` export, `ThemeToggle` 배치, `max-w-shell`, `whitespace-nowrap` |
| `apps/fishtilt/src/components/SiteHeader.test.tsx` | `usePathname` mock, active state 4건, `activeNavId` 8건, blog·toggle 검증 |
| `apps/fishtilt/src/components/SiteFooter.tsx` | 문서 주석만 (5개→6개, active state를 두지 않는 이유) |
| `apps/fishtilt/src/components/RouteNavItem.tsx` | `active` 프롭 → `aria-current` + 색 + 밑줄 |
| `apps/fishtilt/src/components/RouteNavItem.test.tsx` | active/비active 2건 추가 |
| `apps/fishtilt/src/components/HomeLinkCard.tsx` | `LinkCard` 별칭으로 축소 (구현 제거) |
| `apps/fishtilt/src/components/Panel.tsx` | 문서 주석만 (표면 사다리) |
| `apps/fishtilt/src/components/PageHero.tsx` | h1 스케일, description 산문 폭 |
| `apps/fishtilt/src/components/SectionHeading.tsx` | h2 `text-xl`, h3 `text-base`, description 폭 |
| `apps/fishtilt/src/components/Term.tsx` | `bg-black/60` → `bg-scrim-900`, `shadow-2xl` → `shadow-raised` |
| `apps/fishtilt/src/components/RangeMatrix.tsx` | `text-ground-900` → `text-ink-on-action`, 감사 주석 갱신 |
| `apps/fishtilt/src/components/RangeMatrix.test.tsx` | 잉크 토큰 assertion 1건 |
| `apps/fishtilt/src/components/RangeCompareMatrix.tsx` | 셀 2종 + 범례 스와치를 `ink-on-action`으로, 감사 주석 갱신 |
| `apps/fishtilt/src/components/RangeCompareMatrix.test.tsx` | 잉크 토큰 assertion 1건 |
| `apps/fishtilt/src/lib/routes.ts` | `PRIMARY_NAV_IDS`에 `'blog'`, `FOOTER_NAV_IDS`에서 중복 `'blog'` 제거, 주석 갱신 |
| `apps/fishtilt/src/lib/routes.test.ts` | 헤더 6개 pin + `blog` 포함 / `hands`·`about` 미포함 |

`docs/FISHTILT_STATE.md`는 오케스트레이터 소유이므로 건드리지 않았다.

## 테스트 / 검증

| 게이트 | 명령 | before → after |
|---|---|---|
| 유닛 | `pnpm vitest run --project fishtilt --project learn-core` | **129 files / 1461 tests / 0 fail → 132 files / 1571 tests / 0 fail** |
| 타입 | `pnpm typecheck` (모노레포 13 프로젝트) | 0 errors → **0 errors** |
| 린트 | `pnpm lint` | clean → **clean** |
| 빌드 | `pnpm build:fishtilt` | **131개 페이지 전부 정적 유지**(정적 라우트 18 + 콘텐츠 113). 프리렌더 엔트리 총계는 `/icon.svg` 추가로 135 → **136**, 동적 렌더 라우트 **0** |
| E2E | `pnpm e2e:fishtilt` (포트 3221 단독) | 21 files / 211 tests → **22 files / 226 tests / 0 fail** |
| 포맷 | `prettier --list-different <수정 파일>` | 0 (저장소 전역의 기존 드리프트 41개 파일은 손대지 않음) |

추가로 **빌드 산출 CSS를 직접 열어** 확인한 사실 3가지:

1. `:root[data-theme=light]{…}` 블록이 실제로 존재하고 15개 색상 토큰 전부를 재정의한다.
2. 유틸리티는 `var(--color-…)` 참조를 유지한다 (`.bg-panel-700`, `.text-ink-on-action`,
   `.max-w-reading`, `.mt-section`, `.backdrop\:bg-scrim-900::backdrop` 전부 확인).
3. `.bg-brand-600{--color-text-100:var(--color-ink-on-brand)}` 규칙이 살아서 나온다.

**라이트 모드 육안 확인**: 1280px에서 `/tools/range`, `/learn`, `/glossary`를 두 테마로
스크린샷 촬영해 실제로 봤다. 추가로 e2e가 계산된 스타일에서 대비를 계산한다 — 본문/바탕,
13×13 포함·제외 셀 라벨과 채움 분리(양 테마), 라이트 모드 기본 버튼 라벨.

E2E에서 처음 3건이 실패했는데, 원인은 코드가 아니라 **Playwright 기본 컨텍스트가
`prefers-color-scheme: light`를 보고한다**는 사실이었다(즉 미디어 쿼리가 정상 동작한다는
증거였다). 테스트가 OS 선호를 명시하도록 고쳤고 assertion은 약화하지 않았다.

## SEO/UX 관점의 영향

- **`/blog`가 헤더로 승격**(WP-1 §6 우선순위 2). 블로그 20편 = 전체의 15%가 푸터 링크와 홈
  섹션 하나에만 의존하던 상태를 벗어나, 131개 전 페이지에서 헤더 링크를 받는다. 내부링크
  등급이 가장 크게 오른 변화다.
- **파비콘**(우선순위 3). 탭·북마크·SERP에서 브랜드 식별이 처음으로 가능해졌다.
- **nav active state**(우선순위 11). `aria-current="page"`는 스크린리더 사용자에게 현재
  위치를 알려주고, 크롤러에게도 사이트 구조의 신호가 된다.
- **라이트 모드**(우선순위 13). 낮 시간 가독성, 그리고 공유·스크린샷 품질. 검색 결과에서
  들어온 첫 방문자가 OS 설정과 어긋나는 화면을 보지 않는다.
- **읽기 폭 정리**. glossary/hands가 2열 그리드에 맞는 폭을 얻어 스크롤 길이가 줄었다.
- **행간 1.8**은 MDX 본문 113개에도 그대로 적용된다(컴포넌트가 개별로 지정하던 것을 스케일에
  올렸으므로). 한국어 롱폼 체류 시간에 직접 영향.
- 마크업 의미론은 바뀌지 않았다 — 카피 0자 변경, heading 레벨 변화 없음, 링크 구조 변화는
  헤더 `/blog` 1건뿐. 기존 SEO e2e(메타·canonical·JSON-LD·FAQ) 전부 그대로 통과.

## 남은 이슈

> 1·2·3번은 **WP-2b에서 해소되었다.** 아래 `## WP-2b 후속` 참조. 4~8번은 여전히 열려 있다.

1. **다크 테마 hover 대비 3.60:1 (AA 미달, 기존 결함, 경계 밖).**
   `bg-brand-600 hover:bg-brand-500`을 쓰는 기본 버튼 5곳(`ToolCTA.tsx:55`, `RangeQuiz.tsx:64`,
   `QuizQuestionCard.tsx:133`, `QuizResult.tsx:81`, `HomeCallToAction.tsx:33`)은 hover 중 라벨이
   `brand-500` 위에 놓인다. WP-2 이전엔 3.27:1이었고 `ink-on-brand`로 3.60:1까지 올렸지만,
   `brand-500`은 정체성 레드 `#ff334d`라 어둡게 할 수 없고 호출부가 경계 밖이다.
   **권장 수정**: 전용 hover 채움 토큰(예: `brand-700`)을 만들고 그 5곳의 `hover:bg-brand-500`을
   교체. 토큰 추가는 WP-2 산출물이 아니라 그 작업과 같이 해야 한다(사용처 없는 토큰 금지).
2. **`bg-brand-600 text-text-100` 17곳을 `text-ink-on-brand`로 옮겨야 한다.**
   현재는 `globals.css`의 `.bg-brand-600 { --color-text-100: … }` 한 줄이 대신하고 있다.
   대상 파일 11개: `HomeRangePreview`, `ToolCTA`, `StartingHandExplorer`, `RangeFilters`,
   `RangeQuiz`, `QuizQuestionCard`, `RangeMatrixMini`, `QuizResult`, `RangeExplorer`(3곳),
   `OutsCalculator`, `HomeCallToAction`. 옮기고 나면 그 CSS 규칙을 삭제하면 된다.
3. **`apple-icon`은 만들지 않았다.** Next는 `apple-icon`을 PNG/JPEG로만 받고 이 저장소에는
   래스터 생성 수단(sharp, resvg, 이미지 편집기)이 없다. `src/app/icon.svg`에서 180×180 PNG를
   내보내 `src/app/apple-icon.png`로 두면 끝난다 — 자산 작업이라 WP-6 쪽이 자연스럽다.
4. **`HomeLinkCard.tsx`는 삭제 대상이다.** WP-3이 홈을 다시 만들 때 `LinkCard`를 직접 import하고
   이 별칭 파일을 지우면 카드 컴포넌트가 이름까지 하나가 된다.
5. **`--color-brand-950`은 사용처가 0건**이다. 감사 주석이 인용하고 있어 남겼지만, 어떤 WP도
   쓰지 않으면 지우는 편이 낫다.
6. **`text-500`은 두 테마 모두 의도적으로 본문 미달(4.14 / 3.72)**이다. 현재 사용처는
   `Breadcrumbs.tsx:43`의 구분자뿐이고 이는 규칙에 맞다. 다른 WP가 본문에 쓰지 않도록 주의.
7. **데스크톱 nav 6개는 768px에서 여유가 크지 않다.** 현재는 통과하지만, 라벨이 길어지거나
   7번째 항목이 추가되면 `md:flex`를 `lg:flex`로 내려야 한다. `whitespace-nowrap`을 걸어놨으므로
   responsive e2e가 즉시 잡는다.
8. **`prefers-contrast: more` 대응은 없다.** 이번 범위 밖이며, 두 테마 모두 AA를 넘기므로
   시급하지 않다.

## 다음 WP에 넘길 사실 요약

- **색상은 §구현 내용 1의 표가 전부다.** 새 색을 쓰지 말고 역할 토큰을 쓸 것. 새 토큰이 정말
  필요하면 역할 이름으로 짓고 **사용처와 함께** 추가할 것(사용처 없는 토큰 금지). 추가하면
  `src/app/theme-tokens.test.ts`의 `AUDIT` 배열에 그 페어를 넣어야 두 테마 대비가 자동 검증된다.
- **잉크 규칙**: 표면 위 글자는 `text-100`/`text-300`. 채도 높은 **채움 위** 글자는 절대
  `text-ground-900`/`text-text-100`이 아니라 `text-ink-on-action`(액션) 또는
  `text-ink-on-brand`(브랜드).
- **폭**: 산문·1열 목록 `max-w-reading`, 2열 그리드·표 `max-w-grid`, 전역 바 `max-w-shell`.
  섹션 간격 `mt-section`. 페이지 패딩 `py-14 sm:py-20`.
- **타이포**: h1 = `PageHero`(`text-3xl sm:text-4xl`), h2 = `SectionHeading`(`text-xl`),
  h3 = `SectionHeading as="h3"`(`text-base`), 본문 `text-base`(행간 1.8), 캡션 `text-sm`/`text-xs`.
  **`leading-[…]`을 손으로 쓸 필요가 없다** — 스케일이 이미 한글 행간이다.
- **카드**: `LinkCard` 하나만 쓸 것. 새 허브를 만들 때 마크업을 복제하지 말 것.
  **WP-5 썸네일은 `visual` 프롭에 넣으면 된다** — 아무것도 안 넘기면 아무것도 렌더되지 않으므로
  일부 레코드만 먼저 채워도 안전하다. `density="compact"`는 훑는 2열 색인용.
- **테마**: 어떤 컴포넌트도 테마를 알 필요가 없고 알아서도 안 된다. `dark:`/`light:` variant를
  쓰지 말 것. 새 페이지는 `<html>`에 아무것도 하지 않아도 자동으로 두 테마를 얻는다.
- **정적 유지**: `usePathname`은 동적 렌더링을 강제하지 않는다. `useSearchParams`는 강제하므로
  쓰지 말 것. `export const dynamic` 추가 금지.
- **헤더 최종 구성**: 워드마크 / 배우기 · 핸드레인지 · 무료 도구 · 퀴즈 · 블로그 · 포커 용어 /
  검색 · 테마 토글 (모바일에서는 + 햄버거). `hands`·`about`은 푸터.
- **WP-7(SEO)**: 헤더가 6개가 되면서 내부링크 그래프가 바뀌었다 — `/blog`가 131개 전 페이지에서
  인바운드를 받는다. `/icon.svg`가 새 정적 라우트로 생겼으니 sitemap/robots에 포함되지 않는지
  확인할 것(현재 sitemap은 130 URL 그대로).
- **WP-8(최종 QA)**: 테마 관련 회귀는 `src/app/theme-tokens.test.ts`(계산)와
  `tests/e2e/theme-and-header.spec.ts`(브라우저 실측)가 잡는다. 새 서피스를 추가하면 후자의
  13×13 블록과 같은 패턴으로 대비를 계산할 것 — 스크린샷은 증거가 아니다.

---

# WP-2b 후속

WP-2가 "경계 밖이라 넘긴다"고 적었던 세 건을 마스터가 다음 WP로 넘기지 말라고 판정해 파일 경계를
그 세 항목에 한해 확장하고 처리했다. 범위는 (1) 브리지 CSS 규칙 제거 + 잉크 토큰 마이그레이션,
(2) hover AA 미달 해소, (3) `apple-icon.png` 생성. 그 외에는 아무것도 고치지 않았고 카피 변경도
없다.

## 1. `text-text-100` → `text-ink-on-brand` (18곳 / 13개 컴포넌트)

WP-2는 `globals.css`에 브리지 규칙 하나를 두어 브랜드 채움 서브트리 안에서 `--color-text-100`이
`ink-on-brand`를 가리키게 했다. 호출부가 경계 밖이었기 때문이다. 이제 호출부가 직접 토큰을
부르고, **브리지 규칙은 삭제했다.**

```css
/* 삭제됨 */
.bg-brand-600 { --color-text-100: var(--color-ink-on-brand); }
```

빌드 산출 CSS에서 삭제를 확인했다 — 이제 `.bg-brand-600`은 Tailwind가 만든
`background-color:var(--color-brand-600)` 하나뿐이고, 커스텀 속성 재지정 규칙은 없다.

### 감사에 없던 18번째 호출부

마스터가 넘긴 목록은 17곳이었다(라인 단위 grep 결과). 실제로는 **18곳**이다. 놓친 하나는
`OutsCalculator.tsx:284` —

```tsx
<span className={`text-xs font-normal ${selected ? 'text-text-100' : 'text-text-300'}`}>
```

이것은 `bg-brand-600` 요소 **자신**이 아니라 그 **자손**이다. 즉 `bg-brand-600`과
`text-text-100`이 같은 class 문자열에 나타나지 않으므로 어떤 grep으로도 잡히지 않고, 브리지
규칙이 조용히 커버해주고 있던 유일한 자리였다. 브리지만 지우고 여기를 안 고쳤으면 라이트 모드에서
"아웃 개수가 왜 그 숫자인지" 설명하는 문장 — 그 프리셋이 존재하는 이유인 문장 — 이 짙은 빨강 위
거의 검정으로 렌더된다.

앱 전체에서 브랜드 채움의 자손에 잉크 토큰이 필요한 자리는 여기 하나뿐임을 확인했다. 나머지 17곳의
채움 요소는 전부 자식이 맨 텍스트 노드다(13개 파일 전부 열어서 확인). `--color-text-100`을 읽는
다른 유틸리티(`bg-text-100`, `border-text-100` 등)는 앱에 0건이다.

### 검증을 규칙에서 호출부로 옮긴 방법

기존 assertion은 "CSS 규칙이 존재한다 + 그 규칙이 만드는 대비"를 검사했다. 규칙이 사라졌으므로
검사 대상을 옮겼다. 삭제한 assertion 1개, 추가한 assertion 4개:

| 테스트 | 무엇을 증명하나 |
|---|---|
| `has no .bg-brand-600 bridge rule` | 규칙이 없고, 습관으로 되살아나지 않는다 |
| `never pairs the brand fill with the page-ink token in any component` | 모든 `.tsx`의 class 문자열을 파싱해 `bg-brand-600`과 `text-text-100`이 한 요소에 같이 오지 않음 |
| `never uses brand-500 as a fill under text` | `bg-brand-500`(`hover:` 포함)이 앱 전체에 0건 |
| `leaves the identity red itself untouched` | `brand-500`이 여전히 `#ff334d` |
| `OutsCalculator.test.tsx` (기존 테스트에 assertion 추가) | 18번째 자손 호출부를 실제 DOM에서 이름으로 고정 |

class 문자열 파서는 Tailwind 클래스명에 따옴표·중괄호·개행·`$`가 절대 들어갈 수 없다는 점을
이용해 그 문자들로 소스를 자른다. 그래서 한 `className` 값은 항상 한 조각 안에 있고, 삼항의 두
분기처럼 **서로 다른** 두 값이 한 조각으로 합쳐지지 않는다. 여러 줄 `+` 연결만 먼저 이어붙인다.
한계(자손은 못 본다)는 테스트 주석에 명시했고, 그 한 자리는 이름으로 고정했다.

**네거티브 테스트로 게이트가 진짜인지 확인했다**: 호출부 하나를 `text-text-100`으로, 다른 하나를
`hover:bg-brand-500`으로 되돌리자 해당 assertion 2개가 즉시 실패했고, 되돌린 뒤 다시 통과했다.

## 2. hover 채움 AA 미달 해소 — `--color-brand-hover` 신규

`bg-brand-600 hover:bg-brand-500`은 hover 중 라벨을 정체성 레드 `#ff334d` 위에 올려 다크에서
**3.60:1**이었다. `brand-500`은 링크·아이브로·active nav·포커스 링의 잉크이므로 값을 어둡게 할 수
없다. 그래서 hover 전용 채움 토큰을 새로 만들고 5개 호출부를 거기로 돌렸다.

### 값을 어떻게 골랐나 (추측 아님)

흰 잉크가 4.5:1을 넘으려면 채움의 상대휘도가 **L ≤ 0.1833**이어야 한다. `brand-500`은 L=0.2416이라
구조적으로 불가능하다. 그래서 sRGB 전 영역에서 **`brand-500`의 색상각(hue)을 ±2.5° 안으로 유지하고
채도 C\*≥60을 유지한 채 명도 L\*를 최대화하되 잉크 대비 ≥4.68:1을 만족하는 색**을 탐색했다.

| | L\* | C\* | h | 흰 잉크 대비 |
|---|---|---|---|---|
| `brand-600` (기본 채움, 다크) | 46.5 | 76.9 | 28.2° | 5.09:1 |
| `brand-500` (정체성 레드, 옛 hover) | 56.3 | 83.0 | 25.9° | **3.60:1 미달** |
| **`brand-hover` (신규, 다크)** | **48.8** | **82.4** | **23.8°** | **4.68:1** |

색상각과 채도는 `brand-500`과 사실상 같고 명도만 AA가 허용하는 상한에서 잘렸다. 즉 hover는 여전히
"브랜드 레드가 짙고 선명해진다"로 읽히며, 무채색으로 후퇴하지 않았다. 기본 채움 대비 ΔE76 = 8.49,
즉 제자리에서 일어나는 시간적 변화로는 충분히 뚜렷하다. 다크/라이트 두 테마의 실제 스와치를
렌더해 눈으로 확인했다.

### 새 토큰

| 토큰 | 역할 | 다크 | 라이트 |
|---|---|---|---|
| `--color-brand-hover` | 브랜드 채움 — **포인터가 올라간 동안**. `ink-on-brand` 전용 | `#e70341` | `#c2183a` |

- **흰 잉크 대비: 다크 4.68:1 / 라이트 6.02:1** — 두 테마 모두 AA 통과.
- 페이지 바탕 대비(UI 경계): 다크 3.55:1 / 라이트 3.53:1 — 3:1 통과.
- **`brand-500` 값은 손대지 않았다** (`#ff334d` / `#c2183a`). 테스트가 이를 고정한다.
- 라이트 값이 라이트 `brand-500`과 같은 hex인 것은 **측정 결과이지 참조가 아니다.** 라이트에서 옛
  hover는 이미 6.02:1로 통과였으므로 보이는 모습을 그대로 보존했다. 두 토큰은 별개 역할이고 한쪽만
  움직일 수 있다 — CSS 주석에 명시했다.

### 바뀐 호출부 (5곳)

`ToolCTA.tsx:55`, `RangeQuiz.tsx:64`(`enabled:hover:`), `QuizQuestionCard.tsx:133`,
`QuizResult.tsx:81`, `HomeCallToAction.tsx:33`. 전부 `hover:bg-brand-500` →
`hover:bg-brand-hover`. 앱 전체에 `bg-brand-500`은 0건이 되었다(테스트로 고정).

빌드 산출 CSS에서 `hover\:bg-brand-hover:hover{background-color:var(--color-brand-hover)}`와
`enabled\:hover\:bg-brand-hover:enabled:hover{…}`가 모두 `var()` 참조를 유지한 채 생성되고,
`--color-brand-hover`가 4개 블록(`@theme` / `prefers-color-scheme` 라이트 / 명시 라이트 / 명시
다크)에 모두 선언되는 것을 확인했다.

**브라우저 실측 e2e 2건 추가**: 실제 홈 CTA에 진짜 포인터를 올려 (a) 채움이 실제로 바뀌는지,
(b) hover 중 라벨 대비가 4.5:1 이상인지, (c) hover 채움이 여전히 빨강 우세인지(R > max(G,B)+60,
무채색 후퇴 방지)를 두 테마에서 계산한다. `transition-colors` 때문에 보간 중간값을 읽는 flake를
막으려고 측정 직전 transition만 끈다 — hover **규칙** 자체는 그대로 검사한다.

## 3. `apple-icon.png` — 생성 성공

WP-2는 "래스터 생성 수단이 없다"고 적었으나 틀렸다. 이 저장소에는 Playwright chromium이 설치돼
있다. `icon.svg`를 180×180 뷰포트에 렌더해 PNG로 저장했다.

- **`apps/fishtilt/src/app/apple-icon.png` — 180×180, 8-bit RGB, 1,542 bytes.**
- 생성 스크립트는 남기지 않았다(요구사항). 산출 PNG만 남는다.
- `rx="7"` → `rx="0"`으로 **풀블리드 정사각형**으로 렌더했다. Apple 터치 아이콘은 iOS가 자체
  마스크를 씌우므로, 우리가 만든 둥근 모서리를 그대로 두면 투명 모서리를 iOS가 임의 색으로
  합성한 뒤 다시 둥글리게 되어 테두리가 지저분해진다. 알파 채널 없는 RGB로 저장된 것도 같은
  이유다. 문양·색·비율은 `icon.svg`와 동일하다.
- Next의 app-dir 파일 컨벤션이 자동으로 잡았다. 수동 `metadata.icons` 없이 프리렌더 HTML에
  `<link rel="apple-touch-icon" href="/apple-icon.png?…" sizes="180x180" type="image/png"/>`가
  나온다. 빌드 라우트 목록에 `○ /apple-icon.png`가 정적으로 추가됐다.
- e2e 1건 추가: 200 + `image/png` 응답, 그리고 페이지가 링크하는지.

## 변경 파일 (WP-2b)

### 신규 (1)

| 파일 | 내용 |
|---|---|
| `apps/fishtilt/src/app/apple-icon.png` | 180×180 Apple 터치 아이콘 (1,542 bytes) |

### 수정 (17)

| 파일 | 무엇을 |
|---|---|
| `apps/fishtilt/src/app/globals.css` | `--color-brand-hover` 4개 블록에 추가, `.bg-brand-600` 브리지 규칙 삭제(+되살리지 말라는 주석), 대비 감사표에 hover 행 추가 및 KNOWN GAP → CLOSED 갱신, `brand-500` 사용 규칙 보강 |
| `apps/fishtilt/src/app/theme-tokens.test.ts` | 컴포넌트 소스 스캐너 추가, 브리지 assertion 1개 → 신규 4개로 교체, AUDIT에 hover 2쌍 추가 |
| `apps/fishtilt/src/components/OutsCalculator.tsx` | 잉크 토큰 1곳 + **자손 호출부**(18번째) |
| `apps/fishtilt/src/components/OutsCalculator.test.tsx` | 18번째 호출부 회귀 assertion 추가 |
| `apps/fishtilt/src/components/ToolCTA.tsx` | 잉크 + hover |
| `apps/fishtilt/src/components/RangeQuiz.tsx` | 잉크 + hover(`enabled:`) |
| `apps/fishtilt/src/components/QuizQuestionCard.tsx` | 잉크 + hover |
| `apps/fishtilt/src/components/QuizResult.tsx` | 잉크 + hover |
| `apps/fishtilt/src/components/HomeCallToAction.tsx` | 잉크 + hover |
| `apps/fishtilt/src/components/HomeRangePreview.tsx` | 잉크 |
| `apps/fishtilt/src/components/RangeExplorer.tsx` | 잉크 3곳 |
| `apps/fishtilt/src/components/RangeFilters.tsx` | 잉크 |
| `apps/fishtilt/src/components/RangeMatrix.tsx` | 잉크 (선택 셀) |
| `apps/fishtilt/src/components/RangeCompareMatrix.tsx` | 잉크 (선택 셀) |
| `apps/fishtilt/src/components/RangeMatrixMini.tsx` | 잉크 |
| `apps/fishtilt/src/components/StartingHandExplorer.tsx` | 잉크 |
| `apps/fishtilt/tests/e2e/theme-and-header.spec.ts` | hover 실측 2건 + apple-icon 1건 추가, 기존 라이트 버튼 테스트 주석 갱신 |

홈(`src/app/page.tsx`)·툴 페이지(`src/app/tools/*/page.tsx`)·`HomeLinkCard.tsx`는 손대지 않았다.

## 테스트 / 검증 (WP-2b)

| 게이트 | 명령 | WP-2 → WP-2b |
|---|---|---|
| 유닛 | `pnpm vitest run --project fishtilt --project learn-core` | 1572 → **1580 / 0 fail** (132 files) |
| 유닛(fishtilt만) | `pnpm vitest run --project fishtilt` | **121 files / 1466 / 0 fail** |
| 타입 | `pnpm typecheck` | 0 errors → **0 errors** |
| 린트 | `pnpm lint` | clean → **clean** |
| 빌드 | `pnpm build:fishtilt` | **131개 페이지 전부 정적 유지**, 동적 렌더 0. `○ /apple-icon.png` 추가로 프리렌더 엔트리 136 → **137** |
| E2E | `pnpm e2e:fishtilt` | 226 → **229 passed / 0 fail** |

빌드 산출 CSS 직접 확인:

1. `.bg-brand-600` 브리지 규칙 **부재** (남은 것은 Tailwind의 background 유틸리티뿐).
2. `--color-brand-hover`가 4개 블록 모두에 선언 (`#e70341` ×2, `#c2183a` ×2).
3. `.text-ink-on-brand`, `hover\:bg-brand-hover`, `enabled\:hover\:bg-brand-hover` 전부 `var()`
   참조 유지 → 테마 오버라이드가 실제로 먹는다.
4. 프리렌더 HTML에 `rel="apple-touch-icon"` 링크 존재.

**포맷**: 수정한 17개 중 `QuizQuestionCard.tsx`와 `QuizResult.tsx` 2개가 prettier 미준수로
남는다. prettier가 바꾸려는 줄(h2의 ref 속성 배치, 함수 시그니처, li/p 줄바꿈)은 **내가 건드리지
않은 기존 드리프트**이며 WP-2b 이전부터 그런 상태였다. 저장소 전역 드리프트 41개 파일과 같은
범주라 그대로 두었다.

## 남은 이슈 (WP-2b 이후)

WP-2 §남은 이슈의 1·2·3번은 해소됐다. 남은 것:

4. **`HomeLinkCard.tsx` 삭제** — WP-3 소관, 그대로 열려 있음.
5. **`--color-brand-950` 사용처 0건** — 그대로.
6. **`text-500`은 의도적으로 본문 미달** — 그대로.
7. **데스크톱 nav 6개의 768px 여유** — 그대로.
8. **`prefers-contrast: more` 미대응** — 그대로.
9. **(신규) prettier 드리프트 2건** — `QuizQuestionCard.tsx`, `QuizResult.tsx`. 내 변경이
   원인이 아니고, 저장소 전역 드리프트를 정리하는 별도 작업에서 같이 처리하는 편이 낫다.

## 다음 WP에 넘길 사실 요약 (WP-2b 갱신분)

- **브랜드 채움 위 잉크는 언제나 `text-ink-on-brand`다.** `text-text-100`은 페이지 잉크이고
  테마를 따라 반전한다. 이제 CSS가 대신 고쳐주지 않으니 새 코드는 반드시 직접 토큰을 써야 하고,
  안 쓰면 `theme-tokens.test.ts`가 실패한다. **채움 요소의 자손에 텍스트 색을 줄 때도 마찬가지다**
  — 자동 검사가 닿지 않는 유일한 자리이므로 특히 주의.
- **브랜드 채움 hover는 `bg-brand-hover`다.** `hover:bg-brand-500`은 AA 미달이고 테스트가 막는다.
  `brand-500`은 잉크(링크·아이브로·active nav·포커스 링) 전용이며 채움으로 쓰지 않는다.
- **색상 토큰은 이제 16개**다(WP-2의 15개 + `brand-hover`). `## 구현 내용` §1 표에 이 줄을 더해
  읽으면 된다.
- **파비콘 세트 완비**: `src/app/icon.svg`(브라우저 탭) + `src/app/apple-icon.png`(180×180, iOS
  홈 화면). 둘 다 app-dir 파일 컨벤션이므로 `metadata.icons`를 손으로 쓰지 말 것. 마크를 바꾸려면
  `icon.svg`를 고친 뒤 PNG를 다시 렌더해야 한다(수단: Playwright chromium, 이 저장소에 있음).
- **WP-7(SEO)**: 정적 라우트가 하나 더 늘었다(`/apple-icon.png`). `/icon.svg`와 마찬가지로
  sitemap에 들어가지 않아야 한다.
