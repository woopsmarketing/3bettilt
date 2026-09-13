# 3BetTilt Production Editorial Image Integration — 종합 보고서

생성된 AI PNG를 분류·가공해 production asset으로 만들고 사이트에 연결했다. 이미지 생성은 하지 않았다.

| 세부 보고서 | 내용 |
| --- | --- |
| [01 ASSETS](./3BETTILT_IMAGES_01_ASSETS.md) | 원본 분류, 처리 스크립트, 품질·크기 결정, **원본 28장 전체 표**, 총계 |
| [02 INTEGRATION](./3BETTILT_IMAGES_02_INTEGRATION.md) | 레지스트리, BRAND 슬롯 14곳, overlay tier, 목록 반복 완화, AI fact safety, OG 연결·버그 수정 |
| [03 VERIFICATION](./3BETTILT_IMAGES_03_VERIFICATION.md) | 테스트 변경/신규, 실행 결과, 브라우저 QA, 남은 위험 |

## 결론

| 항목 | 값 |
| --- | --- |
| Source images | **28** — ⚠ 지시서는 31장이지만 폴더에 28장만 있음 |
| Brand/static group (06:49~07:10) | **14** — ⚠ 지시서 17 |
| Category group (07:41) | 8 → `theme-*.jpg` 8개 테마에 1:1 |
| Story group (11:53) | 6 → `story-*.jpg` 6편에 1:1 |
| Used source images | **28** |
| Unused source images | **0** |
| Original total size | 44.78 MB |
| Production total size | 3.08 MB |
| Average compression | 93.1% 감소 (≈14.6 : 1), 평균 1,638 KB → 113 KB |
| Largest production file | `theme-rankings.jpg` 201 KB |
| Smallest production file | `brand-hands.jpg` 76 KB |

## 한눈에

- **처리 스크립트:** `apps/fishtilt/scripts/process-editorial-images.mjs` + `editorial-images.manifest.json` (source → crop → resize → JPEG q78 4:4:4).
  sharp는 Next에 포함된 것을 쓰고, 새 의존성은 없다. 원본은 읽기 전용이다(해시 동일). `/visual-source-temp/`는 `.gitignore`에 넣었다.
- **레지스트리:** `visuals.ts`의 기존 `THEME_VISUALS` / `INDIVIDUAL_VISUALS` / `visualOf` 구조를 유지했다. `PAGE_VISUALS`를 2 → 14 슬롯으로 늘렸고,
  컴포넌트는 키로만 참조한다(파일 경로 하드코딩 0, 테스트로 강제).
- **BRAND 배치:** 홈(hero, 로드맵 3, breathing, CTA 배경), 허브 hero(blog, learn, hands, practice, glossary, tools-데스크톱), About(hero, 중간 그림).
  새 섹션 없이 기존 visual 슬롯을 썼다.
- **CSS/scrim:** 톤을 파일에 굽지 않았다. `--ft-cover-hero`(신규, 가장 약함) < `--ft-cover-soft`(아티클) < `--ft-cover-strength`(글자 올린 카드·밴드).
  dark/light 값은 따로 두었다. theme 사진이 목록에 나란히 반복되는 문제는 `li` 위치별 프레이밍(원본/반전/근접 crop) CSS로 완화했다.
- **OG:** featured visual과 같은 파일을 배경으로 쓰고, Satori가 category / title / 3BETTILT를 그린다(1200×630). canonical·og:url·JSON-LD는 그대로다.
  **사진 분기의 잠복 버그로 모든 OG가 500이던 문제를 찾아 고쳤고**, 회귀 테스트를 추가했다.
- **검증:** typecheck·lint PASS, Vitest 영향 범위 1383 tests PASS, Playwright targeted 7/7 PASS(production build 1회),
  대표 화면 브라우저 QA에서 깨진 이미지·overflow·CLS·콘솔 에러 모두 0.

## 사용자 확인이 필요한 것

1. **빠진 원본 3장.** 17장이어야 할 BRAND 그룹이 14장이다. 다른 곳에 있다면 폴더에 넣어 주면 manifest 행 + 슬롯을 추가하겠다.
2. **목록 프레이밍(반전/근접 crop).** 같은 theme 사진이 붙어 나오는 것을 피하려고 넣었다. 원치 않으면 `globals.css`의 두 규칙만 지우면 된다.
3. **OG PNG 용량**(장당 0.55~1.14MB) 수용 여부.
4. `visual-source-temp/`는 그대로 남겨 두었다 — 눈검수 후 직접 삭제하면 된다. 삭제해도 테스트와 빌드는 원본을 읽지 않는다(스크립트 재실행에만 필요).

## 변경 파일

- 신규: `apps/fishtilt/scripts/process-editorial-images.mjs`, `apps/fishtilt/scripts/editorial-images.manifest.json`,
  `apps/fishtilt/public/visuals/*.jpg`(28), `src/components/visual/PageHeroVisual.tsx`, `src/content/visualAssets.test.ts`, `src/lib/og/renderOg.test.tsx`
- 수정: `.gitignore`, `src/content/visuals.ts`, `src/app/globals.css`, `src/components/visual/EditorialVisual.tsx`, `src/components/CtaBand.tsx`(+test),
  `src/components/HomeHeroVisual.tsx`, `src/components/home/HomeRoadmap.tsx`, `src/lib/og/renderOg.tsx`,
  `src/app/[locale]/{page,about/page,blog/page,learn/page,hands/page,practice/page,glossary/page,tools/page}.tsx`,
  테스트 `src/app/[locale]/{page,blog/page,blog/[slug]/page}.test.tsx`, `tests/e2e/{home,blog,seo}.spec.ts`
