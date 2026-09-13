# 3BetTilt Content Editorial Design & Visual Upgrade — 종합 보고서

대상: `apps/fishtilt` (3BetTilt, `/ko`). 브리프: 저장소 루트 `prompt`. 날짜: 2026-09-13.
`apps/web`, 콘텐츠 MDX, URL, 포커 로직, 도구·퀴즈 기능은 건드리지 않았다.

세부 보고서:
[01 타이포·TOC](3BETTILT_EDITORIAL_01_TYPOGRAPHY_TOC.md) ·
[02 비주얼 시스템](3BETTILT_EDITORIAL_02_VISUAL_SYSTEM.md) ·
[03 OG](3BETTILT_EDITORIAL_03_OG_CARDS.md) ·
[04 허브·홈·관련 콘텐츠](3BETTILT_EDITORIAL_04_HUBS_HOME_RELATED.md) ·
[05 검증](3BETTILT_EDITORIAL_05_VERIFICATION.md) ·
[비주얼 매니페스트](3BETTILT_EDITORIAL_VISUAL_MANIFEST.md)

## 1. 변경한 컴포넌트

- 신규: `content/visuals.ts`, `components/visual/{assetSource, ThemeArt, EditorialVisual, EditorialCard, VisualBackdrop}`,
  `EditorialHeadings`, `home/HomeBreathing`, `lib/og/{ogCard, renderOg, fonts/*}`, `app/og/[kind]/[file]/route`.
- 수정: `mdx-components`, `TableOfContents`, `BlogArticleShell`, `GuideArticleLayout`, `StoryArticleLayout`,
  `BlogArticleFooter`, `BlogHubSections`, `blogHubModel`, `RelatedContent`, `NextRead`, `LearnTopics`,
  `HomeRoadmap`, `HomeStories`, `HomeHeroVisual`, 페이지(`[locale]/page`, `learn/[slug]`, `glossary/[slug]`,
  `hands/[hand]`), `lib/seo/metadata`, `globals.css`, `next.config.ts`.
- 규모: 기존 파일 30개 +1,124 / −262, 신규 19개 파일(테스트 포함).

## 2. 타이포그래피

`.editorial-body` 스코프 안에서만 적용. 전역 prose 규칙 불변. 헤딩 CSS는 `@layer components`.

## 3. H1 / H2 / H3

H1 44/30px(아티클), 56/36px(홈·허브). H2 1.5→1.875rem·700·레드 바(번호 글은 `01 ──` 카운터).
H3 1.25rem·650·작은 레드 마커. id는 TOC와 같은 `headingId`로 결정론적, 중복 0(테스트).

## 4. TOC

기존 컴포넌트 재작성, 리스트 1개. 모바일 `<details>` 접힘 / `lg` 강제 펼침(`::details-content`).
헤딩 3개 미만이면 없음. 용어 페이지는 설계상 없음. 모바일 링크 44px.

## 5. 데이터 모델

`visuals.ts` 레지스트리: 테마 8 + 개별 6(핸드 스토리) + 페이지 2. `visualOf(record)` → 후보(개별→테마) +
결정론적 variant. 콘텐츠 레코드 스키마 불변.

## 6. 이미지 정책

분위기만(카드 앞면·레인지·숫자·보드·글자 금지), 제목은 항상 live HTML, 카드 전체 클릭(stretched-link, 중첩
앵커 없음), next/image AVIF/WebP + `sizes`, `priority`는 히어로만. 다크/라이트 같은 파일·오버레이만 차등.

## 7. OG

`/og/<kind>/<slug>.png` 1200×630, 124개 정적 프리렌더. 페이지와 같은 visual source, 카테고리·제목·3BETTILT.
Pretendard 서브셋(OFL). canonical·og:url·title·JSON-LD 불변(실측).

## 8. 홈

H1·CTA 유지. 히어로 visual 슬롯(`home-hero.jpg`, 현재 ThemeArt). breathing 밴드 신규
("숫자를 외우는 대신, 왜 그런지 이해하세요." → "홀덤 처음부터 배우기" `/ko/learn`). Featured Story 1 / Learn 3단계
visual / Tool 1. 인기·트렌드 주장 없음.

## 9. 실제 AI 이미지가 필요한 asset 목록 — **NOT GENERATED**

이미지 생성 도구가 없어 **0/16 생성**. 가짜 파일 없음. 모든 슬롯은 결정론적 ThemeArt.
`theme-{basics,rankings,starting-hands,range,position,betting,math,story}.jpg` (1920×1080),
`story-{qq-vs-72o-flop-227,full-house-loses,qq-three-bet-frustration,river-changes-everything,aa-loses,ak-flop-miss}.jpg` (1920×1080),
`home-hero.jpg` (1600×2000), `home-breathing.jpg` (2400×1028).
프롬프트·크롭·용량·투입 방법: [매니페스트](3BETTILT_EDITORIAL_VISUAL_MANIFEST.md). `public/visuals/`에 넣으면 코드 변경 없이 반영.

## 10. Targeted verification

typecheck PASS · eslint 0 errors · build PASS(272 static, ƒ 0) · vitest 2,516 + 신규 21 PASS ·
e2e 7 spec 1차 172/7 → 수정 후 실패 3 spec 재실행 91/0 · SEO spot check PASS · 대표 페이지 20 샷 QA.
실패 7건 중 2건은 실제 결함으로 코드 수정(TOC 터치 타깃, 도구 CTA 채움 표면), 3건은 새 디자인 계약에 맞춘
테스트 갱신, 1건(stretched-link 측정)은 측정 대상을 실제 클릭 영역으로 옮김. 상세는 05.

## 11. 남은 작업

1. **실제 이미지 16개 생성·투입** (매니페스트). 투입 시 `blog.spec`의 `data-visual-source="art"`/"no image files"
   단언을 의도적으로 갱신해야 한다.
2. 전체 `pnpm verify` + 전체 e2e는 최종 릴리스 게이트에서 1회 (이번엔 targeted만).
3. 공용 `TableOfContents` 변경으로 tools-guide·about TOC도 새 박스 스타일 — 의도 확인 필요.
4. 레슨 featured visual은 16:9가 아니라 21:9(레슨 헤더가 이미 길어 첫 화면 확보 목적).
5. 블로그 허브 모바일에서 검색 가이드 상위 3개 stacked 카드가 세로로 길다 — 사진 투입 후 row 전환 여부 판단.
6. 새 글이 OG 서브셋에 없는 희귀 한글을 쓰면 `ogCard.test.ts`가 실패 → `glyphs.txt` 재서브셋(pyftsubset).
7. `git status`의 `apps/fishtilt/next-env.d.ts` 변경은 Next 빌드가 자동 생성한 것.

## 시간 분배 (대략, 세션 타임스탬프가 컨텍스트 압축으로 나뉘어 정확한 분 단위는 없음)

| 단계 | 비중 |
| --- | --- |
| 현황 파악 + before 스크린샷 | ~10% |
| 비주얼 레지스트리·ThemeArt·카드 컴포넌트 | ~25% |
| 아티클 구조·헤딩·TOC | ~15% |
| 허브·홈·관련 콘텐츠 | ~20% |
| OG 라우트·폰트 서브셋 | ~10% |
| 단위 테스트 갱신·신규 | ~8% |
| Visual QA·lint·build·e2e·수정 | ~10% |
| 보고서 | ~2% |

## 다음에 줄일 수 있는 것 (3)

1. **e2e 계약을 먼저 grep** — `data-source="fallback"`, 밴드 개수, 44px 터치 타깃, D-S3-17 "no box surface" 같은
   기존 e2e 단언을 구현 전에 확인했다면 build → e2e 왕복 1회를 줄였다.
2. **공용 컴포넌트 변경 전 사용처 확인** — TOC를 데스크톱/모바일 두 리스트로 만들었다가 3개 테스트가 깨져
   재작성했다. `TableOfContents` 사용처·테스트를 먼저 봤으면 처음부터 단일 `<details>`로 갔다.
3. **OG 폰트·route handler 제약을 먼저 스파이크** — CDN 경로 오류, `notFound()` 500, 한국어 줄바꿈을 각각
   따로 겪었다. 1개 slug로 최소 OG를 먼저 띄워 제약을 확인한 뒤 확장하는 편이 빨랐다.
