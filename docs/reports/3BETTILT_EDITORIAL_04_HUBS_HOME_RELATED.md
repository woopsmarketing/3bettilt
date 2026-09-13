# 3BetTilt Editorial — 04. 관련 콘텐츠 · 블로그 허브 · Learn 허브 · 홈

## 관련 콘텐츠 — 역할별로 다른 문법

| 역할 | 컴포넌트 | 처리 |
| --- | --- | --- |
| 다음 글 (Next) | `NextRead.tsx` `NextStep` | 가장 강한 패널: 레드 좌측 바 + 표면 + 3:2 썸네일(sm↑) + "다음 글" + 제목 + 화살표 |
| 같이 알아둘 용어 | `RelatedContent` `TermRow` | 컴팩트 텍스트 목록: 용어 — 한 줄 풀이, 화살표, 줄 구분선 |
| 직접 확인하기 (도구) | `ToolTile` | CTA: "직접 해보기" + 도구명 + 레드 원형 화살표 버튼, 레드 좌측 룰. **채움 표면 없음**(D-S3-17) |
| 비슷한 핸드 | `ThumbCard` (hands) | `VisualBackdrop` 위 실제 PokerCards + stretched link |
| 더 배우기 / 비슷한 글 | `ThumbCard` | stacked `EditorialCard` 3:2, 2열 |
| 먼저 읽기 (prerequisites) | `LinkRow` | 기존 줄 목록 |

`LAYOUT_OF` 매핑으로 관계 → 레이아웃 결정, `data-layout="terms|tools|cards|rows"`.

## 블로그 허브 (`blogHubModel.ts`, `BlogHubSections.tsx`)

순서 `HUB_SECTION_ORDER`: Featured → 검색 가이드 → 핸드 스토리 → 초보자 실수 → 데이터와 확률 → 포커 개념·문화
(섹션·앵커 nav·보조 레일 모두 같은 순서).

- Featured: overlay 카드(lg, h2, `priority`, eyebrow `이 글부터 · <타입>`) + 우측 "이어서 읽기" 레일.
- 검색 가이드(`guides` 레이아웃, 신규): 앞 3개 stacked 3열 → 나머지 row 카드 2열.
- 핸드 스토리: 16:9 stacked 3열.
- 나머지: row 카드.

## Learn 허브

커리큘럼(순서 로드맵, 15편 3단계) 그대로. "특정 주제 배우기" 카테고리 열마다 21:9 테마 visual
(`themeVisual(LEARN_CATEGORY_THEME[id], id)`).

## 홈

- H1 "홀덤, 외우지 말고 이해하면서 배우세요."와 CTA 2개 유지.
- 히어로 visual: `home-hero.jpg` 슬롯. 없으면 `ThemeArt story`(소품 off) 위에 기존 결정론적 AKQJ10 카드.
  기존 인라인 `Scene` SVG 제거.
- 신규 breathing 밴드 `HomeBreathing`: 21:9 visual, 데스크톱 좌측 텍스트/모바일 하단 텍스트,
  "숫자를 외우는 대신, 왜 그런지 이해하세요." + CTA "홀덤 처음부터 배우기" → `/ko/learn`.
  섹션 이름 "3BetTilt가 가르치는 방식", 도구 밴드 다음·스토리 앞. 광고 배너 문법(가격·긴급성·과장) 없음.
- 위계: 로드맵 단계마다 21:9 테마 visual(Learn 3), 스토리 밴드 Featured Story 1(overlay 카드) +
  목록, 도구 밴드는 대표 도구 1 + 목록(기존).
- 인기·트렌드·최신성 주장 없음 (e2e `claims no popularity and no recency` PASS).

## 변경 파일

`RelatedContent.tsx`, `NextRead.tsx`, `BlogArticleFooter.tsx`, `blogHubModel.ts`, `BlogHubSections.tsx`,
`LearnTopics.tsx`, `HomeRoadmap.tsx`, `HomeStories.tsx`, `HomeHeroVisual.tsx`, `home/HomeBreathing.tsx`(신규),
`app/[locale]/page.tsx`, `next.config.ts`.
테스트: `RelatedContent.test.tsx`, `blogHubModel.test.ts`, `page.test.tsx`(홈 밴드 12개).
