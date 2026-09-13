# 3BetTilt Editorial — 03. OG 카드 시스템

## 라우트

`src/app/og/[kind]/[file]/route.tsx` → `/og/<learn|blog|glossary|hands>/<slug>.png`

- `dynamic = 'force-static'`, `dynamicParams = false`, `generateStaticParams` = 발행된 모든 레코드.
- 빌드 결과: `● /og/[kind]/[file]` SSG, **124 경로 프리렌더**, 동적(ƒ) 라우트 0.
- 모르는 slug → `404 Not found` Response. (`notFound()`는 route handler에서 `app-router-context` 모듈 파싱
  오류로 500을 내서 쓰지 않는다.)

## 렌더 — `src/lib/og/renderOg.tsx`

- 1200×630 `ImageResponse` (`next/og`).
- 배경: 페이지와 **같은 visual source** — 자산 있으면 JPG data URI, 없으면 ThemeArt와 같은 `artLight`
  조명 위치의 radial/linear 그라데이션. 좌측 어두운 그라데이션.
- 레이아웃: 상단 워드마크 "■ 3BETTILT", 하단 레드 바 + 카테고리(`#ff6b7d`) + 제목.
- 제목 `wordBreak: keep-all`(한국어 어절 중간 줄바꿈 방지), 길이별 68/58/50/44px.
- 카테고리 `ogCardCategory`: 블로그 콘텐츠 타입 / `배우기 · <카테고리>` / `포커 용어 · <카테고리>` / `시작 핸드`.
- 폰트: Pretendard Bold (SIL OFL, 라이선스 동봉) 서브셋 340 KB — ASCII + KS X 1001 한글 2,350자 +
  콘텐츠에 쓰인 모든 한글. `ogCard.test.ts`가 **모든 제목·카테고리 글리프가 서브셋에 있는지** 검사
  (새 글이 희귀 음절을 쓰면 테스트가 실패 → `glyphs.txt` 재서브셋).
- 결과 PNG 약 78–83 KB.

## 메타데이터 — `src/lib/seo/metadata.ts`

- `PageMetadataInput.image?: { path, alt }` 추가. `contentMetadata`만 `ogCardPath(record)`를 넘긴다.
- 그 외 페이지(홈·허브·도구)는 기존 `/og.png` 그대로.
- **변경하지 않음**: canonical, og:url, title 의미, description, Article/FAQ/Breadcrumb JSON-LD(스크립트 병합 없음).
- 실측 `/ko/blog/aks-vs-ako`: canonical·og:url = `https://3bettilt.com/ko/blog/aks-vs-ako`,
  og:image/twitter:image = `https://3bettilt.com/og/blog/aks-vs-ako.png` 1200×630,
  JSON-LD 3블록 `Article`, `FAQPage`, `BreadcrumbList`. PNG 200 `image/png` 79,664 B.

## 파일

신규 `lib/og/{ogCard.ts, renderOg.tsx, fonts/Pretendard-Bold-subset.otf, fonts/Pretendard-OFL.txt,
fonts/glyphs.txt}`, `app/og/[kind]/[file]/route.tsx`, `lib/og/ogCard.test.ts`.
수정 `lib/seo/metadata.ts`, `tests/e2e/seo.spec.ts`(콘텐츠 페이지 og:image 경로, 카드 PNG 4종 200, 404 확인).
