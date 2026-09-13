# 3BetTilt Editorial — 02. Featured Visual 시스템 (데이터 모델 · 이미지 정책)

## 데이터 모델 — `src/content/visuals.ts`

- `VISUAL_THEMES` 8개: `basics, rankings, starting-hands, range, position, betting, math, story`.
- `THEME_VISUALS` — 테마당 1개 공유 자산 `theme-<id>.jpg` (1920×1080).
- `INDIVIDUAL_VISUALS` — 핸드 스토리 6편, record id 키, `story-<slug>.jpg`.
- `PAGE_VISUALS` — `home-hero.jpg`(1600×2000), `home-breathing.jpg`(2400×1028).
- 매핑: `TOPIC_THEME`, `LEARN_CATEGORY_THEME`, `GLOSSARY_CATEGORY_THEME`. 블로그 hand-story → `story`,
  hands → `starting-hands`.
- `visualOf(record)` → `{ theme, scope: 'individual'|'theme', candidates, variant }`. 후보는 개별 → 테마 순.
- 콘텐츠 레코드(`types.ts`, registry)는 **수정하지 않았다**. 116/124개가 같은 8개 값을 반복하게 되므로
  프레젠테이션 매핑은 레지스트리 한 곳에 둔다.

## 해석 — `components/visual/assetSource.ts` (server only)

`resolveAsset(visual)`이 `public/visuals/<file>`을 빌드 시 `existsSync`로 확인 → 첫 존재 파일의
`{ spec, src, path }`, 없으면 `null`. **파일을 떨어뜨리면 코드 변경 없이 교체된다.**

## 렌더링 컴포넌트

| 컴포넌트 | 역할 |
| --- | --- |
| `EditorialVisual` | 고정 비율 박스(16/9, 3/2, 21/9, 3/1, 4/5, 1/1, fill). 자산 있으면 `next/image fill` + `sizes` + `priority`(히어로만), 없으면 `ThemeArt`. `data-visual`, `data-visual-source="art|asset"`, `data-visual-scope`. scrim `soft`/`bottom`. |
| `ThemeArt` | 결정론적 CSS/SVG 장면: 램프, 테이블 림, 테마별 소품(뒷면 카드, 무지 칩, 균일 13×13 격자, 좌석 링, 사분원), grain, vignette. `variant`(record id, FNV-1a)로 조명 위치·소품 위치만 바뀐다. 텍스트·숫자·id 없음, `aria-hidden`. 고정 팔레트(사진처럼 테마 무관). `motif={false}`면 소품 생략(실제 카드가 위에 올라갈 때). |
| `EditorialCard` | overlay / stacked / row. **제목 `<a class="stretched-link">`가 유일한 링크** — `::after`가 카드 전체를 덮어 카드 전체 클릭, 중첩 앵커 없음, focus-visible 링이 카드 외곽에. `href=null`이면 링크 없이 "준비 중" 배지. |
| `VisualBackdrop` | `.cover-stage` — 배경 visual + scrim 위에 결정론적 콘텐츠(PokerCards, 수치). 라이트 테마에서도 어두운 배경 위라 surface/ink 토큰을 다크 값으로 재지정. |

## 이미지 정책 준수

- 사진·ThemeArt 모두 **분위기만**: 카드 앞면·레인지·숫자·보드 없음. 실제 카드는 `PokerCards`가 데이터로.
- 제목은 이미지에 굽지 않음 — 카드 제목은 live HTML, OG 제목은 Satori 텍스트.
- 성능: `next.config.ts` `images.formats = ['image/avif','image/webp']`, 슬롯마다 `sizes`, `priority`는 아티클
  히어로·허브 featured·홈 히어로만. 나머지 lazy(기본).
- **실제 AI 이미지: NOT GENERATED** (생성 도구 없음). 명세는 `3BETTILT_EDITORIAL_VISUAL_MANIFEST.md`.
  `public/visuals/`는 비어 있고 모든 슬롯은 `data-visual-source="art"`.

## 다크/라이트

같은 자산, 오버레이만 다름 — `--ft-cover-strength`/`--ft-cover-soft` 다크 .9/.34, 라이트 .78/.12.
커버 위 잉크는 항상 밝은색(`.cover-ink`). 세 테마 블록(media light, `[data-theme=light]`, `[data-theme=dark]`)에
모두 정의.

## 신규 파일

`content/visuals.ts`, `components/visual/{assetSource.ts, ThemeArt.tsx, EditorialVisual.tsx,
EditorialCard.tsx, VisualBackdrop.tsx}` + 테스트 `visuals.test.ts`, `assetSource.test.ts`,
`EditorialCard.test.tsx`(모양별 링크 1개, planned 링크 0, ThemeArt 결정론·텍스트/id 없음).
