# 3BetTilt Images — 02. 레지스트리 · 슬롯 연결 · 오버레이 · OG

## 레지스트리 (`apps/fishtilt/src/content/visuals.ts`)

기존 구조를 그대로 두고 확장했다: `THEME_VISUALS` · `INDIVIDUAL_VISUALS` · `PAGE_VISUALS` · `visualOf` · `themeVisual` · `pageVisual`.

| 레지스트리 | 그룹 | 변경 |
| --- | --- | --- |
| `THEME_VISUALS` (8) | B · CATEGORY | 파일명·크기 그대로. alt 문구를 실제 사진 내용에 맞게 수정 |
| `INDIVIDUAL_VISUALS` (6) | C · STORY | 파일명·크기 그대로. alt 수정. 우선순위 **개별 → theme-story → ThemeArt** 유지 |
| `PAGE_VISUALS` (2 → 14) | A · BRAND | `homeHero`(1600×2000 → **1120×1400**), `homeBreathing` 유지 + 12개 추가. `pageAsset()` 헬퍼, `PageVisualKey` 타입 |

`TOPIC_THEME` / `LEARN_CATEGORY_THEME` / `GLOSSARY_CATEGORY_THEME` 매핑은 손대지 않았다. Learn · Glossary · 검색 가이드 · Hands 페이지는
기존 `visualOf(record)` 매핑 그대로 실제 파일을 쓴다. 파일이 사라지면 같은 박스에 `ThemeArt`로 떨어지는 fallback도 남아 있다.

컴포넌트에는 파일 경로를 쓰지 않는다. 컴포넌트는 `PAGE_VISUALS.<key>` 또는 `<PageHeroVisual slot="<key>">`로만 참조하고,
`visualAssets.test.ts`가 이를 강제한다(키마다 사용처 정확히 1곳, 코드 안 파일명 0개).

## BRAND 슬롯 배치 (14)

| key | 파일 | 위치 | 비율 | overlay tier |
| --- | --- | --- | --- | --- |
| `homeHero` | home-hero.jpg | `/` hero (`HomeHeroVisual`, 5장 카드는 코드로 그림) | 4:5 | hero |
| `homeStageRules` | home-stage-rules.jpg | `/` 로드맵 1단계 | 21:9 | hero |
| `homeStageRangePosition` | home-stage-range-position.jpg | `/` 로드맵 2단계 | 21:9 | hero |
| `homeStagePostflopMath` | home-stage-postflop-math.jpg | `/` 로드맵 3단계 | 21:9 | hero |
| `homeBreathing` | home-breathing.jpg | `/` breathing 밴드 | 21:9 | side (기존) |
| `homeFeature` | brand-feature.jpg | `/` 마지막 CTA 밴드 배경 | fill | band (가장 강함) |
| `blogHub` | brand-blog.jpg | `/blog` hero | 3:2 | hero |
| `learnHub` | brand-learn.jpg | `/learn` hero | 3:2 | hero |
| `handsHub` | brand-hands.jpg | `/hands` hero | 3:2 | hero |
| `practiceHub` | brand-practice.jpg | `/practice` hero | 3:2 | hero |
| `glossaryHub` | brand-glossary.jpg | `/glossary` hero | 3:2 | hero |
| `toolsHub` | brand-tools.jpg | `/tools` hero (**데스크톱만**, 모바일 첫 화면은 도구 목록 몫) | 3:2 | hero |
| `aboutHero` | brand-about.jpg | `/about` hero 아래 | 16:9 | hero |
| `aboutTable` | brand-about-table.jpg | `/about` "숫자는 어떻게 계산하는가?" 섹션 앞 | 21:9 | hero |

- 새 **섹션**은 만들지 않았다. hub hero는 원래 있던 `PageHero`/`EditorialHero`의 `visual` 슬롯(`layout="split"`)을 썼다.
  블로그 hub 주석에 "VA-08: asset이 생기면 들어갈 자리"로 이미 예약돼 있던 슬롯이다.
  About 중간 그림과 CTA 배경 두 곳만 기존 요소에 붙인 저위험 슬롯이다.
- 홈 로드맵은 원래 theme 사진(basics/position/math)을 썼는데, 같은 사진이 `/learn` 카테고리에도 나와서 전용 brand 사진으로 바꿨다(fallback theme은 유지).
- 같은 화면에 비슷한 인물 구도가 붙지 않게 분산했다. 세로 인물 사진 6장은 **각기 다른 페이지**의 hero 한 곳씩에만 들어간다.

### 새 / 변경 컴포넌트

- `components/visual/PageHeroVisual.tsx` (신규): `slot` 키 + fallback `theme` → `EditorialVisual`(priority, `scrim="hero"`, `desktopOnly` 옵션).
- `CtaBand.tsx`: 선택 prop `backdrop?: ReactNode`를 추가했다. 주면 `.cover-stage` + `.cover-scrim-band`, 안 주면 기존 brand-tint와 똑같다.
  서버 전용 asset resolver를 import하지 않도록 prop이 아니라 slot으로 받는다.
- `HomeRoadmap.tsx`: `STAGE_VISUAL`(asset + fallback theme). 매핑이 없는 단계는 예전처럼 basics theme.
- `HomeHeroVisual.tsx`: 사진 위에 `cover-scrim-hero` 한 겹 추가, 주석 갱신.
- `EditorialVisual.tsx`: `VisualScrim`에 `'hero'` 추가.

## CSS / scrim 방식 (`apps/fishtilt/src/app/globals.css`)

이미지 파일에는 톤을 굽지 않았다. 오버레이 세기는 **변수 하나당 한 단계**로 두고, 이미지마다 inline opacity를 넣지 않았다.

| tier | 변수 | dark | light | 용도 |
| --- | --- | --- | --- | --- |
| hero | `--ft-cover-hero` (신규) | 0.20 | 0.06 | 페이지 첫 사진(홈 hero, hub, About, 로드맵) — 사진 톤 유지 |
| soft | `--ft-cover-soft` (기존) | 0.34 | 0.12 | 아티클 featured visual |
| bottom / side / band | `--ft-cover-strength` (기존) | 0.90 | 0.78 | 사진 **위에** 글자가 올라가는 카드·밴드 |

- `.cover-scrim-hero` (신규): 아래쪽 45%만 살짝 가라앉힌다.
- `.cover-scrim-band` (신규): CTA 밴드. 왼쪽 글자와 오른쪽 버튼 양끝은 진하고 가운데는 사진이 보인다(1.0 → 0.62 → 0.8 × strength).
- 세 테마 블록(`prefers-color-scheme: light`, `[data-theme=light]`, `[data-theme=dark]`)에 모두 정의했다.

### 목록 안 theme 사진 반복 완화

theme 사진 8장이 약 116개 페이지에 공유되기 때문에, 블로그 hub 검색 가이드 3열 그리드나 관련 핸드 목록에서 **같은 사진이 나란히** 나왔다(QA에서 발견).
그래서 CSS만으로 `li` 위치별 프레이밍을 넣었다:

```css
li:nth-child(3n + 2) [data-visual-scope='theme'][data-visual-source='asset'] img { transform: scaleX(-1); }
li:nth-child(3n)     [data-visual-scope='theme'][data-visual-source='asset'] img { transform: scale(1.3); transform-origin: 38% 58%; }
```

- 원본 / 좌우 반전 / 가까운 crop 3종이라, 행·열·그리드에서 인접한 카드끼리 프레임이 겹치지 않는다.
- **theme scope만** 적용된다. 스토리 개별 사진과 brand 사진은 반전되지 않는다.
- theme 사진에는 읽을 수 있는 글자나 카드 앞면이 없어서, 반전해도 사실을 틀리게 보여주지 않는다.
- 파일·톤·오버레이는 그대로이고 새 사본도 만들지 않는다.

## AI fact safety

- 모든 사진은 decorative(`alt=""`, 슬롯 안). 정확한 카드는 여전히 `PokerCards` / `RangeMatrix` / 코드로 그린 hero 5장이 담당한다.
- 원본에 있던 격자 종이(theme-range)는 zoom crop으로 약화했다.
- 스토리 사진의 보드 카드는 흐릿해서 식별이 안 되고, 사진 바로 아래에 결정론적 카드가 따로 나온다.
- 세로 원본 #05(About)의 앞면 카드는 16:9 crop 밖으로 잘라냈다.
- 사진에 baked text 없음.

## OG 연결

구조는 그대로다: `/og/<kind>/<slug>.png` → `renderContentOg(record)` → `resolveAsset(visualOf(record))` → 같은 JPEG를 base64로 넣은 배경 +
Satori가 category / title / 3BETTILT를 렌더(1200×630). 별도 OG 사진 세트는 만들지 않았다.

**발견·수정한 잠복 버그:** 지금까지 asset 파일이 하나도 없어서 사진 분기가 실행된 적이 없었다. 루트 div style에
`backgroundImage: undefined`가 들어가자 Satori가 `Cannot read properties of undefined (reading 'trim')`을 던졌고,
**모든 `/og/*.png`가 500**을 반환했다. 사진이 있을 때는 키 자체를 넣지 않도록 조건부 spread로 고쳤다(`renderOg.tsx`).
재발 방지로 `renderOg.test.tsx`(node 환경)를 추가했다.

canonical · og:url · title · description · JSON-LD 의미는 바꾸지 않았다. 홈·허브 같은 비콘텐츠 페이지는 기존 `/og.png`를 유지한다.

**참고(위험):** 사진 배경 OG PNG는 장당 547KB~1.14MB, 빌드 산출물 124장 합계 약 105MB다(`ImageResponse`는 PNG만 출력).
플랫폼 한도(수 MB)에는 들어가지만 이전 텍스트 카드보다 훨씬 무겁다.
