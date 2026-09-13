# 3BetTilt Images — 03. 테스트 변경 · 검증 결과

## 테스트 변경 (삭제·약화 없음)

| 파일 | 이전 가정 | 지금 검증하는 것 |
| --- | --- | --- |
| `src/app/[locale]/page.test.tsx` | hero `data-hero-visual="scene"`, img 0 | `photo`, img 정확히 1개, `alt=""`, src = `PAGE_VISUALS.homeHero.file`. 카드 5장 `role="img"` 검증은 그대로 |
| `src/app/[locale]/blog/page.test.tsx` | "draws no image files" | 모든 img가 `[data-visual-source="asset"]` 슬롯 안 + `alt=""` + 레지스트리 등록 파일. hub brand 사진 존재. `url(` 배경 0 |
| `src/app/[locale]/blog/[slug]/page.test.tsx` (가이드) | `data-visual-source="art"`, img 0 | `asset`, 슬롯 img 1개 = theme 파일, `alt=""`. 관련 카드 img도 전부 슬롯 안. `url(` 0 |
| `src/app/[locale]/blog/[slug]/page.test.tsx` (스토리 fixture) | img 0 | 개별 사진이 없는 스토리 → `theme-story` asset fallback |
| `tests/e2e/home.spec.ts` | hero img 0 / scene | img 1, `alt=""`, `photo`, 실제 디코드(`naturalWidth>0`) |
| `tests/e2e/blog.spec.ts` (hub, 가이드, figure 3종) | `main img` 0, `[src*=".jpg"]` 0 | `expectOnlySlotPictures()`: 모든 img가 슬롯 안·decorative·`/visuals/*.jpg`, style `url(` 0. 가이드 hero 디코드 확인. figure 안 img 0 |
| `tests/e2e/seo.spec.ts` | OG 200 + png | 추가: IHDR **1200×630**, >150KB(사진 배경) |

## 신규 테스트

- `src/content/visualAssets.test.ts`
  - manifest 28행, 원본·출력 중복 없음, **생성 시각으로 그룹 검증**(07:41 → category, 11:53 → story, 06:49~07:10 → brand)
  - category = `THEME_VISUALS`, story = `INDIVIDUAL_VISUALS`, brand = `PAGE_VISUALS` (집합 일치), 크기 일치, 비율 유지
  - `public/visuals/` 파일 목록 = manifest, JPEG SOF 실제 크기 = 레지스트리, 20KB < size < 300KB
  - `PAGE_VISUALS` 키마다 코드 사용처 정확히 1곳(= 28장 모두 실제 사용), 코드에 파일 경로 0
- `src/lib/og/renderOg.test.tsx` — 스토리·핸드 카드가 자기 production 사진 위에 1200×630 PNG로 렌더되는지
- `src/components/CtaBand.test.tsx` — backdrop 모드(`cover-stage`, `cover-scrim-band`, aria-hidden 레이어, 링크 유지)

## 실행 결과

| 검증 | 결과 |
| --- | --- |
| `pnpm --filter fishtilt typecheck` (`tsc --noEmit`) | PASS |
| ESLint (변경 파일 전부, 스크립트 포함) | PASS (0 error / 0 warning) |
| Vitest 영향 범위 (content, visual, app/[locale], home, blog, learn, og, seo, theme-tokens) | **88 files / 1383 tests PASS** |
| Playwright targeted (production build + `next start :3221`) — home hero, blog hub, 가이드 hero, figure 3종, OG | **7 / 7 PASS** |
| Production build (`next build`, e2e webServer 내 1회) | PASS, OG PNG 124장 prerender |
| OG dev fetch: `/og/blog/qq-vs-72o-flop-227`, `/og/learn/hand-matrix`, `/og/glossary/flush`, `/og/hands/aa` | 200 · image/png · 1200×630 · 사진 배경 확인 |
| 원본 해시 전/후 (28) | 동일 |

실행하지 않은 것(지시대로): full monorepo test, full e2e, `pnpm verify`, 전체 screenshot suite.

## 브라우저 QA (dev :3220, 기존 서버 재사용)

| 화면 | img | broken | 가로 overflow | CLS | console error |
| --- | --- | --- | --- | --- | --- |
| desktop dark `/ko` | 7 | 0 | 0 | 0 | 0 |
| desktop dark `/ko/blog` | 18 | 0 | 0 | 0 | 0 |
| desktop dark `/ko/learn` | 8 | 0 | 0 | 0 | 0 |
| desktop dark `/ko/about` | 2 | 0 | 0 | 0 | 0 |
| desktop dark `/ko/blog/qq-vs-72o-flop-227` | 9 | 0 | 0 | 0 | 0 |
| desktop dark `/ko/learn/hand-matrix` | 18 | 0 | 0 | 0 | 0 |
| desktop dark `/ko/glossary/flush` | 3 | 0 | 0 | 0 | 0 |
| desktop dark `/ko/hands/aa` | 3 | 0 | 0 | 0 | 0 |
| desktop dark `/ko/hands`, `/practice`, `/glossary`, `/tools` | 1씩 | 0 | 0 | 0 | 0 |
| mobile dark `/ko`, `/ko/blog` | 7 / 18 | 0 | 0 | 0 | 0 |
| mobile dark `/ko/blog/qq-vs-72o-flop-227` | 9 | 1* | 0 | 0 | 0 |
| light `/ko`, `/ko/blog/qq-vs-72o-flop-227` | 7 / 9 | 0 | 0 | 0 | 0 |

\* 모바일에서 `display:none`인 NextRead 썸네일이다. lazy 이미지라 요청 자체가 안 가는 정상 동작이고, 보이는 이미지 중 깨진 것은 없다.

눈검수 결과와 조치:

- **crop / 얼굴:** brand-hands 정수리 잘림 → focus 수정. 나머지 인물은 얼굴이 온전하다.
- **반복:** 블로그 hub 3열에서 같은 theme 사진이 나란히 나옴 → 목록 프레이밍 CSS 적용 후 인접 카드가 서로 다르게 보인다. hand-matrix 관련 핸드 목록도 같은 방식.
- **CTA 밴드:** 얇은 띠 crop이 인물 상반신 가운데로 잡힘 → 원본 교체(칩 쌓는 손).
- **overlay / 가독성:** hero는 사진 톤 유지. 카드 overlay 제목, breathing 문장, CTA 문구·버튼 모두 dark·light에서 읽힌다. light 모드에서 사진이 과하게 검어지지 않는다.
- **dev 캐시 주의:** 파일 이름을 유지한 채 내용을 바꾸면 dev 서버 `.next/dev/cache/images`가 옛 이미지를 계속 준다. 캐시 폴더를 비운 뒤 재확인했다. 프로덕션 빌드에는 영향 없음.

## 남은 위험 / 후속

1. **원본 31 → 28:** 지시서의 3장이 폴더에 없다. 찾으면 manifest에 행을 추가하고 `PAGE_VISUALS` 키와 사용처를 추가해야 한다(테스트가 셋의 일치를 강제한다).
2. **OG 무게:** 사진 배경 PNG가 장당 0.55~1.14MB다.
3. **업스케일:** 16:9 theme/story는 ×1.15, 21:9 wide 두 장은 ×1.44 확대다(원본 폭 1672px). 지시서 규격을 따른 결과이고, 1:1에서 눈에 띄는 열화는 없었다.
4. `docs/reports/3BETTILT_EDITORIAL_VISUAL_MANIFEST.md` / `_02_VISUAL_SYSTEM.md`의 "NOT GENERATED / public/visuals 비어 있음" 문구는 과거 시점 기록이라 수정하지 않았다. `docs/STATE.md` 갱신 대상이다.
