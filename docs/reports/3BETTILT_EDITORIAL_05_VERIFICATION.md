# 3BetTilt Editorial — 05. Targeted Verification

기준: 2026-09-13, `apps/fishtilt`, 로컬 worktree. 전체 스위트 반복 없음.

## 결과 요약

| 게이트 | 결과 |
| --- | --- |
| `pnpm typecheck` (fishtilt) | PASS |
| `eslint apps/fishtilt` | PASS — 0 errors (기존 `.data/tools/seo-audit.mjs` console 경고 2개, 이번 변경 무관) |
| prettier | 이번에 수정/생성한 `.ts/.tsx/.css` 파일만. `.mdx`·저장소 전체 실행 안 함 |
| vitest 전체 fishtilt (신규 테스트 추가 전) | 223 files / 2,516 tests PASS |
| vitest 신규 6 파일 | 21 tests PASS |
| vitest 최종 수정 후 `RelatedContent`, `TableOfContents` | 18 tests PASS |
| `pnpm build` (2회: 최초 + e2e 수정 반영) | PASS, 272 static pages, `/og/[kind]/[file]` SSG 124 경로, ƒ 0 |
| e2e 1차: seo, blog, home, learn, glossary, hands, responsive-a11y | 172 PASS / 7 FAIL |
| e2e 2차 (실패 3 spec만 재실행): home, blog, responsive-a11y | 91 PASS / 0 FAIL |
| SEO spot check `/ko/blog/aks-vs-ako` | canonical·og:url 불변, og:image 절대 URL, JSON-LD Article/FAQPage/BreadcrumbList 각 1 |

## 1차 e2e 실패 7건과 처리

| # | 테스트 | 원인 | 처리 |
| --- | --- | --- | --- |
| 1 | home: renders every band | 새 breathing 밴드로 region 11→12 | **설계 계약 변경** — `SECTIONS`에 "3BetTilt가 가르치는 방식" 추가 |
| 2 | blog hub: featured visual | 구 `EditorialImage`의 `data-source="fallback"` | 새 속성 `data-visual-source="art"`로 갱신. "no image files" 단언은 그대로 유지 |
| 3 | blog article: 16:9 visual | 구 `data-aspect`/`data-topic` | `data-visual=starting-hands`, `data-visual-source=art`, 실측 비율 ≈16:9, ThemeArt `aria-hidden`·`<text>` 0 으로 갱신(검사 강도 동일 이상) |
| 4–6 | responsive-a11y 44px (430/390/360) | (a) TOC 링크 36px — **실제 결함** (b) stretched-link 카드 제목 18–21px | (a) 코드 수정: 모바일 `min-h-11`. (b) 실제 탭 타깃은 `::after`가 덮는 카드 전체. 테스트에 `<label>` 예외와 같은 구조 규칙 추가: `.stretched-link`는 가장 가까운 positioned 조상의 높이로 측정 |
| 7 | responsive-a11y: related links no box surface (D-S3-17) | 도구 CTA 타일에 채움 배경 | **코드 수정**: 채움 제거, 레드 좌측 룰 + 원형 화살표 버튼으로 CTA 유지. 결정(D-S3-17)은 재개하지 않음 |

단언 약화: 없음. (b)는 측정 대상을 실제 클릭 영역으로 옮긴 것이며 이유를 테스트 주석에 기록.

## Visual QA (대표 페이지만)

`.data/tools/shoot.mjs`, dev 서버 재사용. 홈·블로그 허브·검색 가이드(aks-vs-ako)·핸드 스토리(qq-vs-72o)·
Learn 허브·Learn 상세(hand-matrix)·용어(flush)·핸드(aa) × 1440/390 다크 + 홈·아티클 라이트.
20 샷 전부 200, h1 1개, 가로 overflow 0. 육안 확인 항목:

- 다음 글 패널 썸네일 폭 버그(최초 발견) → 수정 후 정상
- 모바일 TOC 접힘 "목차 7개 섹션", 데스크톱 2열 펼침
- 라이트 모드 아티클 visual·TOC 대비 정상, 홈 히어로 라이트 정상
- 핸드 페이지 VisualBackdrop 위 카드·수치 가독 정상, ThemeArt 소품이 실제 카드와 겹치지 않음(motif off)
- breathing 밴드: 단일 문장 + 하나의 CTA, 광고 문법 아님

실행하지 않은 것(DEFERRED): 전체 `pnpm verify`, 전체 e2e(도구·퀴즈 spec) — 이번 범위 밖이며 최종 릴리스 게이트에서.
