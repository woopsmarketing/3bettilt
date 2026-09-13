# 3BetTilt Editorial — 01. 아티클 구조 · 타이포그래피 · TOC

범위: `apps/fishtilt` 블로그(검색 가이드·핸드 스토리), 레슨, 용어, 핸드 상세.

## 아티클 구조

eyebrow(콘텐츠 타입) → H1 → description → 메타(토픽·레벨·읽는 시간) → **featured visual** → TOC → 본문.

| 페이지 | featured visual | TOC | 본문 래퍼 |
| --- | --- | --- | --- |
| 검색 가이드 `GuideArticleLayout` | 16:9, breakout, `priority`, scrim soft | numbered + collapsible | `.editorial-body[data-numbered]` |
| 핸드 스토리 `StoryArticleLayout` | 16:9 (개별 → story 테마) | 기존 유지 | `.editorial-body` (번호 없음) |
| 레슨 `learn/[slug]` | 21:9, `lg:-mx-28` | 헤딩 ≥ 3개일 때 numbered + collapsible | `.editorial-body[data-numbered]` |
| 용어 `glossary/[slug]` | 카드 용어: `VisualBackdrop` 위 결정론적 카드 / 그 외 3:1 밴드 | **없음(설계상 짧은 글)** | `.editorial-body` |
| 핸드 `hands/[hand]` | key-facts 영역을 `VisualBackdrop`으로 (PokerCards·수치는 데이터로 그대로) | 없음 | `.editorial-body`, 섹션 h2 → `EditorialH2` |

## 헤딩 위계 (H1 ≫ H2 ≫ H3 > body)

- 전역 타이포는 건드리지 않았다. 규칙은 `.editorial-body` 안의 `.ed-h2` / `.ed-h3`에만 적용 (`globals.css`
  `@layer components` — 레이어 안에 둬야 `mt-0` 같은 유틸리티가 이긴다).
- **H2** `clamp(1.5rem → 1.875rem)`, 700, 위 여백 4.5rem, 위에 2.25rem×3px 브랜드 레드 바.
  `data-numbered`일 때는 바 대신 `01 ──` 모노 카운터(CSS counter, 마크업에 숫자 없음).
- **H3** 1.25rem, 650, 작은 레드 사각 마커. H2 바로 뒤 H3는 여백 축소.
- H1 실측: 아티클 44px(데스크톱) / 30px(모바일), 홈·허브 56px / 36px.

## 결정론적 id

- `mdx-components.tsx`의 h2/h3 → `EditorialH2`/`EditorialH3` (`src/components/EditorialHeadings.tsx`).
- id = `headingId(textOf(children))` — TOC가 쓰는 `articleHeadings.ts`와 **같은 함수, 같은 텍스트**.
- `BlogArticleShell`의 `MdxH2`는 `EditorialH2` 별칭으로 축소(두 번째 구현 제거).
- 테스트: 모든 MDX kind에서 h2 id 중복 없음 (`EditorialHeadings.test.tsx`).

## TOC (`TableOfContents.tsx` 재작성, 기존 컴포넌트 재사용)

- 리스트는 **항상 하나**. `collapsible`이면 네이티브 `<details>` 안에 넣고
  `@media (min-width:64rem) ::details-content { content-visibility: visible }`로 데스크톱에서 강제 펼침.
  모바일은 "목차 N개 섹션" 요약만 보이고 닫혀 있다. `::details-content` 미지원 브라우저는 데스크톱에서도
  동작하는 접힘 상태로 남는다(기능 손실 없음).
- 번호는 level-2 항목에만, `aria-hidden`.
- 6개 초과면 `lg`에서 2열.
- 링크 높이: 모바일 44px(`min-h-11`), `lg` 36px — e2e 터치 타깃 규칙 대응.
- 부수 효과: 공용 컴포넌트라 tools-guide·about 페이지 TOC도 새 박스 스타일을 받는다(비접힘 모드).

## 변경 파일

`mdx-components.tsx`, `EditorialHeadings.tsx`(신규), `TableOfContents.tsx`, `BlogArticleShell.tsx`,
`GuideArticleLayout.tsx`, `StoryArticleLayout.tsx`, `learn/[slug]/page.tsx`, `glossary/[slug]/page.tsx`,
`hands/[hand]/page.tsx`, `globals.css`.

## 테스트

`EditorialHeadings.test.tsx`(신규), `TableOfContents.test.tsx`(collapsible 케이스 추가),
`blog/[slug]/page.test.tsx`(visual 속성 계약 갱신). e2e `blog.spec` TOC 앵커 테스트 PASS.
