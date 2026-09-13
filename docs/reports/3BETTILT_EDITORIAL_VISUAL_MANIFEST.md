# 3BetTilt — Editorial Visual Manifest (AI 이미지 생성 대상 목록)

> **상태: NOT GENERATED.** 이 실행 환경에는 이미지 생성 도구가 없다. 아래 16개 파일은 하나도 만들어지지
> 않았고, 사이트의 모든 visual slot은 현재 결정론적 CSS/SVG 장면(`ThemeArt`)을 그린다.
> 이 문서는 생성할 파일의 명세다. 생성된 척하는 파일·placeholder JPG는 저장소에 없다.

## 넣는 방법 (코드 변경 없음)

1. 아래 파일명 그대로 `apps/fishtilt/public/visuals/<file>`에 저장한다.
2. `pnpm build` (또는 dev 재시작). `assetSource.ts`가 빌드 시 `existsSync`로 파일을 찾으면
   `next/image`(AVIF/WebP, `sizes`별 리사이즈)로 교체되고, OG 카드(`/og/<kind>/<slug>.png`)도 같은 사진을
   배경으로 쓴다. 파일이 없으면 계속 `ThemeArt`.
3. 우선순위: 개별(story-*) → 테마(theme-*) → ThemeArt. 스토리 사진이 없으면 `theme-story.jpg`를 쓴다.

소스 오브 트루스: `apps/fishtilt/src/content/visuals.ts` (`allVisualAssets()`), 테스트 `visuals.test.ts`.

## 공통 스타일 정책 (모든 프롬프트 앞에 붙인다)

```
Cinematic editorial photograph, late-night private poker room, charcoal and near-black
palette, one deep red practical light source, shallow depth of field, soft film grain,
calm and serious mood, premium magazine look, generous negative space on the LEFT/BOTTOM
for live text overlay.
STRICT: no readable playing cards (cards face down or out of focus only), no card ranks or
suits, no chips with numbers, no text, no letters, no numbers, no logos, no brand marks,
no casino signage, no money, no screens, no UI, no charts or grids, no identifiable
celebrity faces, no hands in motion blur that look like cheating, adults only.
```

금지 이유: 카드·레인지·숫자는 페이지가 데이터로 그린다(`PokerCards`, 13×13 표). 사진이 사실을 말하면
콘텐츠와 충돌한다. 제목은 절대 이미지에 굽지 않는다 — 카드와 OG가 HTML/Satori로 올린다.

## 납품 규격

| 구분 | 마스터 해상도 | 포맷 | 목표 파일 크기(마스터 JPG q≈80) |
| --- | --- | --- | --- |
| theme-* / story-* | 1920×1080 (16:9) | JPG, sRGB | 180–350 KB (배포는 next/image가 썸네일 60–120 KB, 히어로 120–220 KB로 변환) |
| home-hero | 1600×2000 (4:5) | JPG, sRGB | 250–400 KB (배포 150–250 KB) |
| home-breathing | 2400×1028 (21:9) | JPG, sRGB | 250–400 KB (배포 150–250 KB) |

크롭 안전영역: 16:9 마스터는 3:2(카드), 21:9(레슨 헤더), 3:1(용어 밴드)로도 잘린다 → **피사체를 가운데
60% 폭, 세로 중앙 ~ 하단 2/3 안에** 둔다. 상단 1/4과 좌측 1/3은 어둡고 비워서 텍스트·그라데이션이 얹힐 수
있게 한다. 다크/라이트 모두 같은 파일을 쓰고 오버레이 강도만 다르다(다크 .9/.34, 라이트 .78/.12).

## 테마 비주얼 (8) — Learn·Glossary·검색 가이드·핸드 페이지가 공유

| # | file | 사용처 | 피사체 프롬프트 (공통 정책 뒤에) |
| --- | --- | --- | --- |
| 1 | `theme-basics.jpg` | 레슨 `game-start`, 용어 `game`, 토픽 rules | An empty felt poker table under a single low red lamp, dark room, chairs pushed in, quiet before the game. |
| 2 | `theme-rankings.jpg` | 레슨·용어 족보, 토픽 hand-strength | A fan of face-down playing cards on dark felt, soft raking side light catching the card edges. |
| 3 | `theme-starting-hands.jpg` | 레슨·용어 시작 패, 모든 `/hands/*`, 토픽 starting-hands | Close-up of a player's hand resting beside two face-down hole cards, fingers lightly on top, red rim light. |
| 4 | `theme-range.jpg` | 레슨 range, 토픽 range | A calm study table: closed notebook, pencil, a cup, a deck squared face down, warm-red desk lamp, no writing visible. |
| 5 | `theme-position.jpg` | 레슨·용어 position | Top-down view of an empty six-seat oval poker table with a plain unmarked dealer button, dramatic single light. |
| 6 | `theme-betting.jpg` | 레슨·용어 betting | A hand sliding a short stack of plain unmarked chips forward, background table in soft focus. |
| 7 | `theme-math.jpg` | 레슨·용어 math, 토픽 odds/equity | Profile of a thoughtful player in shadow, chin on hand, red light on one side of the face, face not identifiable. |
| 8 | `theme-story.jpg` | 모든 핸드 스토리의 폴백 | Late-night poker room, two players focused on one pot, seen from behind a shoulder, heavy atmosphere. |

## 개별 비주얼 (6) — 핸드 스토리 (블로그 hand-story)

| # | file | 글 id | 피사체 프롬프트 |
| --- | --- | --- | --- |
| 9 | `story-qq-vs-72o-flop-227.jpg` | `blog-qq-vs-72o-flop-227` | A player staring down at the table the moment the flop is dealt, frozen expression, face partly in shadow. |
| 10 | `story-full-house-loses.jpg` | `blog-full-house-loses` | A player leaning back in the chair after the river, exhaling, looking at the ceiling light. |
| 11 | `story-qq-three-bet-frustration.jpg` | `blog-qq-three-bet-frustration` | A player with arms crossed, watching an opponent's plain chip stack across the table. |
| 12 | `story-river-changes-everything.jpg` | `blog-river-changes-everything` | A dealer's hand placing the final card face down on the felt, extreme close-up, red light. |
| 13 | `story-aa-loses.jpg` | `blog-aa-loses` | A player quietly sliding cards face down toward the muck in front of an empty pot area. |
| 14 | `story-ak-flop-miss.jpg` | `blog-ak-flop-miss` | A player idly riffling a few plain chips while thinking, board out of focus. |

## 페이지 비주얼 (2) — 홈

| # | file | 크기 | 사용처 / 크롭 | 피사체 프롬프트 |
| --- | --- | --- | --- | --- |
| 15 | `home-hero.jpg` | 1600×2000 (4:5) | 홈 히어로 오른쪽 프레임. 모바일은 전체 폭. 하단 1/3에 결정론적 카드(AKQJ10)가 겹칠 수 있으니 하단은 어둡고 단순하게. | A player at a poker table under red light, absorbed in the game, vertical composition, subject upper-middle, dark lower third. |
| 16 | `home-breathing.jpg` | 2400×1028 (21:9) | "숫자를 외우는 대신, 왜 그런지 이해하세요." 밴드. 데스크톱은 **좌측 40%에 텍스트**(좌→우 그라데이션), 모바일은 하단 텍스트. | Wide establishing shot of a dark poker room, one low light over a table on the RIGHT half, left half nearly black. |

## 검수 체크리스트 (파일을 넣은 뒤)

- [ ] 16개 파일명 정확 (`visuals.test.ts`가 id·파일명 유일성 검사)
- [ ] 카드 앞면·숫자·글자·로고 없음 (육안)
- [ ] `/ko`, `/ko/blog`, `/ko/blog/aks-vs-ako`, `/ko/learn/hand-matrix`에서 `data-visual-source="asset"` 확인
- [ ] 라이트 테마에서 카드 제목 대비 확인 (오버레이 .78)
- [ ] `/og/blog/<slug>.png` 재빌드 후 사진 배경 확인
- [ ] e2e `blog.spec.ts`의 "no image files"/`data-visual-source="art"` 단언은 **사진 도입 시 의도적으로 갱신**해야 한다
