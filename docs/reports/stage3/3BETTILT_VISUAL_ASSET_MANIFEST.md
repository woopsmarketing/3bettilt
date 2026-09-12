# 3BetTilt 비주얼 자산 매니페스트 (WP-S3-04)

계약 AB가 요구하는 자산 매니페스트. 규칙과 어휘는 `3BETTILT_VISUAL_STYLE_GUIDE.md`(이하 **SG**)에 있고,
이 문서는 자산 하나당 한 항목이다. **모든 항목의 status는 `NOT GENERATED (no image capability in
Stage 3 session)`** — 예외는 이미 존재하는 `public/og.png`(VA-22) 하나뿐이다.

읽는 법
- **치수**는 저장소에 넣는 마스터 파일의 픽셀 크기다. `next/image`가 그 아래 크기를 만든다.
- **안전 영역**은 프레임 대비 퍼센트(x: 좌→우, y: 상→하). "비워 둘 것"은 오버레이 슬롯, "안에 둘 것"은
  크롭 슬롯이다. 프레임 바깥 4%는 `object-fit: cover` 허용 오차(SG §6).
- **네거티브**: SG §10 공통 블록은 항상 붙인다. 아래 "네거티브 추가"는 항목별 추가분만 적는다.
- **크기 예산**은 budget이지 측정값이 아니다(계약 BY). 실측은 파일이 생긴 뒤 `ls -l`로만 기록한다.
- **테마**: 별도 표기가 없으면 "한 벌, `EditorialImage` 프레임(rounded-lg + 1px line-500) 안에서 두 테마
  공용"(SG §6).
- **연결 WP**: 자산을 코드에 꽂는 WP. 이 WP(S3-04)는 코드를 만지지 않는다.
- 슬러그 앞에 `(planned)`가 붙은 스토리는 아직 존재하지 않는다(WP-S3-08이 확정). 슬러그는 제안값이다.
- WP-S3-03의 프리미티브 이름(`Section` / `EditorialHero` / `EditorialImage` / `StatStrip`)은 오케스트레이터
  브리프에서 가져왔다. 이 문서를 쓰는 시점에 `docs/3BETTILT_STAGE3_STATE.md`에는 D-S3-01..07만 있고
  D-S3-10..17은 아직 기록되지 않았다 — 이름이 바뀌면 이 문서의 "연결" 줄만 바꾸면 된다.

우선순위 집계 (29 항목): **P0 11** (VA-01, 03~07, 09~12, 22 — 09~12의 3:2 카드 크롭은 각 항목에 포함) ·
**P1 13** (VA-02, 08, 13, 14, 15, 17, 18, 23~28) · **P2 5** (VA-16, 19, 20, 21, 29). 신규 생성이 필요한
것은 VA-22(존재)와 스크립트 파생 VA-23~29를 제외한 **21 항목**(텍스처 2 항목은 각 2벌).

---

## A. 홈

### VA-01 — 홈 히어로 (하이브리드: AI 장면 + 로열 플러시 SVG 오버레이)
- **page/route**: `/` (홈 히어로 우측 컬럼, `EditorialHero` 비주얼 슬롯)
- **purpose**: 사이트의 첫인상. "프리미엄·에디토리얼·약간 드라마틱"을 한 장으로. 카드 앞면은 코드가 그린다(계약 Z).
- **dimensions**: 1200 × 1500 px (마스터) · **aspect**: 4:5 (근거 SG §9)
- **composition**: 세로 구도. 인물은 프레임 상단 60%에 상반신, 살짝 앞으로 기울여 테이블 레일에 팔을 얹음.
  얼굴은 카메라를 향하고 시선은 렌즈. **하단 30%는 빈 차콜 펠트/테이블면**으로 비운다(오버레이 슬롯).
  카메라 높이는 테이블면보다 약간 위, 60~85mm 느낌, 얕은 심도.
- **subject**: 30대 전후의 플레이어 1명(성별·인종은 생성 시 다양하게 후보를 뽑아 고른다; 동아시아인 후보
  포함). 캐주얼하지만 단정한 차림(니트·셔츠). 표정은 "이미 결과를 아는 사람의 조용한 확신" — 크게 웃지
  않는다. **손에 카드 없음**, 칩은 옆에 소량, 아웃포커스, 무액면.
- **lighting**: 위 45° 따뜻한 키 라이트 1개(얼굴·손), 화면 밖 좌측에서 브랜드 레드 계열 림 라이트(어깨·레일
  가장자리). 배경은 `#101319` 대역으로 잦아듦. 레드 예산 ≤ 12%.
- **background**: 프라이빗 룸의 어두운 벽, 디테일 최소. 슬롯 머신·군중·네온 없음.
- **safe area**: 얼굴·손 = x 28–76%, y 8–58% 안에 둘 것. **오버레이 예약 영역 x 8–92%, y 64–94%는 카드·칩·
  손 없이 비워 둘 것.** 가장자리 4% 여유.
- **generation prompt** (EN):
  > Editorial magazine portrait, vertical 4:5. A poker player in their early thirties sits at a dark
  > charcoal-felt table in a quiet private room after hours, leaning slightly forward with forearms
  > resting on the padded table rail, looking straight into the camera with a calm, knowing
  > half-smile. Hands are relaxed and empty; no playing cards anywhere in the frame. A few generic
  > unmarked dark chips sit out of focus to one side. The lower third of the frame is clean empty
  > charcoal felt. Single warm tungsten key light from above at 45 degrees on the face and hands,
  > a thin crimson rim light from off-frame left on the shoulder and rail edge, background falling
  > into near-black charcoal with no detail. Restrained cinematic colour grade: cool charcoal
  > shadows lifted (not crushed), natural skin tones, one red accent only. Shot on an 85mm lens
  > with shallow depth of field, fine film grain, sharp focus on the eyes. Premium, modern,
  > editorial, intelligent, friendly, slightly dramatic. Casual knit sweater, no jewelry.
- **negative 추가**: `playing cards in hand, cards on table, dealer, other players, crowd, green felt,
  cigar, bow tie`
- **exact overlay needed?**: **예.** 스페이드 로열 플러시 A♠ K♠ Q♠ J♠ T♠, `PokerCard` 기반 SVG 오버레이
  (WP-S3-05가 홈 히어로 컴포넌트 안에 구현). 좌표(프레임 % 기준): 카드 5장, 중심 y = 79%, 중심 x = 26 / 38 /
  50 / 62 / 74%, 카드 폭 = 프레임 폭의 15%(높이는 폭 × 1.4), 회전 −8° / −4° / 0° / +4° / +8°, z-order는
  좌→우 오름차순(오른쪽 카드가 위). 오버레이는 `role="img"`, 이름 "스페이드 로열 플러시: A K Q J 10".
  오버레이 카드의 랭크·수트는 `learn-core`/`PokerCard`의 타입을 통해 지정하고 문자열로 하드코딩하지 않는다.
- **alt**: `""` (장식. 사실은 오버레이가 나른다)
- **filename**: `public/images/editorial/home-hero-royal-flush.webp`
- **format / budget**: WebP(q≈80), **≤ 300 KB**. `next/image` `priority`, `sizes="(min-width: 1024px) 45vw, 100vw"`.
- **theme**: 한 벌 공용. 프레임 안. 이미지 가장자리 닫힘 필수.
- **priority**: **P0**
- **status**: NOT GENERATED (no image capability in Stage 3 session)
- **연결 WP**: WP-S3-05 (히어로 + 오버레이). 폴백 = `HomeHeroVisual`.

### VA-02 — 홈 "3BETTILT STORIES" 기본 피처드 아트
- **page/route**: `/` 06 Stories 섹션, 피처드 스토리 비주얼
- **purpose**: 피처드 스토리에 자기 히어로(VA-09~14)가 있으면 그것을 쓴다. 이 자산은 **피처드 스토리에
  히어로가 없을 때의 섹션 기본 아트**이자 블로그 허브 "Featured Story" 폴백이다.
- **dimensions**: 1920 × 1080 · **aspect**: 16:9 (카드용 3:2 크롭 1200 × 800 파생)
- **composition**: 수평 구도. 테이블 위, 쇼다운 직전. 양쪽 끝에서 두 사람의 손만 프레임 안으로 들어오고
  얼굴은 없다. 중앙 팟(칩 소량)이 초점. 카드는 **뒷면**으로 각자 앞에 놓임.
- **subject**: 두 플레이어의 손·소매, 뒷면 카드 두 장씩, 작은 칩 더미. 인물 정체성 없음.
- **lighting**: 중앙 펜던트 키 라이트, 양쪽 손에 대칭 림. 레드는 우측 림 하나.
- **background**: 차콜 펠트, 상단은 어둠.
- **safe area**: 피사체 x 8–92% 안(3:2 크롭 보존). 텍스트 오버레이 없음.
- **generation prompt** (EN):
  > Cinematic editorial still, 16:9, the moment before a showdown at a dark charcoal-felt poker
  > table. Only the hands and sleeves of two players enter the frame from the left and right
  > edges; no faces. Each player has two playing cards face down in front of them, backs plain
  > and unmarked; a small modest pot of generic dark chips sits in the centre in sharp focus.
  > Warm tungsten pendant light from above, symmetrical rim light on both hands, a single thin
  > crimson rim on the right side only. Charcoal shadows lifted, natural skin tones, restrained
  > grade, 50mm lens, shallow depth of field, fine grain. Quiet tension, premium magazine feature.
- **negative 추가**: `faces, card faces up, large chip stacks, cash`
- **exact overlay needed?**: 아니오
- **alt**: `""`
- **filename**: `public/images/editorial/stories-featured-showdown.webp` (+ `-card.webp` 3:2 크롭)
- **format / budget**: WebP, 히어로 ≤ 200 KB, 카드 ≤ 150 KB. lazy. `sizes="(min-width: 1024px) 60vw, 100vw"`.
- **theme**: 한 벌 공용
- **priority**: P1
- **status**: NOT GENERATED (no image capability in Stage 3 session)
- **연결 WP**: WP-S3-05 (홈), WP-S3-06 (블로그 허브 피처드 폴백)

## B. 블로그 카테고리 아트워크 (5) — 1:1

공통: 카테고리 내비(블로그 허브·홈 07 섹션)에서 1:1로, **해당 카테고리 글의 히어로/카드 폴백**으로 16:9·3:2
크롭되어 쓰인다. 그래서 피사체는 **중앙 16:9 밴드 y 22–78%** 안에 둔다(SG §9). 다섯 장이 한 세트로
읽혀야 하므로 같은 조명·같은 펠트·같은 그레이딩, 피사체만 다르다. 사람 얼굴 없음(카테고리는 개념이다).
치수 1200 × 1200, WebP ≤ 120 KB, lazy, `sizes="(min-width: 640px) 200px, 40vw"`, alt `""`, 테마 한 벌 공용,
연결 WP-S3-06(허브·템플릿) + WP-S3-05(홈 07 섹션), 상태 NOT GENERATED. 이 세트는 **P0**이다 —
런치 시점에 스토리 외의 모든 블로그 글이 이 다섯 장을 히어로로 쓴다.

### VA-03 — 핸드 스토리 (Hand Stories)
- **purpose**: 서사·감정. "한 판의 이야기".
- **composition/subject**: 뒷면 카드 두 장이 펠트 위에 살짝 겹쳐 놓이고, 그 옆에 손 하나가 카드 모서리를
  막 들어 올리려는 순간(앞면은 보이지 않음). 정사각 중앙.
- **lighting/background**: 따뜻한 키 + 좌측 레드 림. 차콜 펠트.
- **generation prompt**: > Square editorial still life on dark charcoal felt: two playing cards face
  down, backs plain and unmarked, slightly overlapping, and a single hand lifting one corner as if
  about to peek — the card faces remain completely hidden. Warm tungsten key light from upper
  right, thin crimson rim light from the left, background falling to charcoal. Restrained grade,
  85mm macro feel, shallow depth of field, fine grain. Quiet, cinematic, premium.
- **negative 추가**: `card face visible, pips, index`
- **filename**: `public/images/category/hand-stories.webp`
- **priority**: P0 · **status**: NOT GENERATED (no image capability in Stage 3 session)

### VA-04 — 검색 가이드 (Search Guides)
- **purpose**: "질문에 완전한 답". 명료함·정리.
- **composition/subject**: 펠트 위에 뒷면 카드 여러 장이 **정확히 격자로** 정렬(3×3 정도), 그중 한 장만
  약간 앞으로 나와 있음. 손 없음.
- **generation prompt**: > Square editorial still life: nine playing cards face down, backs plain and
  unmarked, arranged in a precise three-by-three grid on dark charcoal felt, one card pushed
  slightly forward out of alignment. Overhead warm tungsten light, soft shadows, a single thin
  crimson rim on the displaced card only. Clean, orderly, restrained, premium; 50mm, moderate
  depth of field, fine grain.
- **negative 추가**: `card face visible, hands`
- **filename**: `public/images/category/search-guides.webp`
- **priority**: P0 · **status**: NOT GENERATED (no image capability in Stage 3 session)

### VA-05 — 초보자 실수 (Beginner Mistakes)
- **purpose**: "누구나 하는 실수" — 비난이 아니라 공감. 살짝 유머.
- **composition/subject**: 칩 한 개가 테이블 가장자리에서 굴러 떨어지기 직전, 혹은 뒷면 카드 한 장이
  레일 밖으로 반쯤 걸쳐 있음. 손은 프레임 밖.
- **generation prompt**: > Square editorial still life: a single generic unmarked dark poker chip
  balanced on the padded rail of a charcoal-felt table, tipping over the edge, caught mid-fall
  against a near-black background. Warm tungsten key light from above, a thin crimson rim
  outlining the chip's edge. Gentle humour, restrained, premium, 85mm macro, shallow depth of
  field, fine grain.
- **negative 추가**: `chip denomination, casino logo, motion blur smear`
- **filename**: `public/images/category/beginner-mistakes.webp`
- **priority**: P0 · **status**: NOT GENERATED (no image capability in Stage 3 session)

### VA-06 — 데이터와 확률 (Data & Probability)
- **purpose**: 숫자·빈도·비율. 단, **숫자를 그리지 않는다**(사실은 도해가 그린다).
- **composition/subject**: 뒷면 카드 한 무더기가 부채꼴로 넓게 펼쳐진 덱(52장 느낌), 그 위에 아무 표기
  없는 반투명 유리 칩 하나. 규칙적 리듬이 "분포"를 암시.
- **generation prompt**: > Square editorial still life: a full deck of playing cards spread in a wide
  even fan face down on dark charcoal felt, backs plain and unmarked, the spacing perfectly
  regular like a distribution; one unmarked translucent dark chip resting on the fan. Cool-neutral
  overhead light, a single thin crimson rim on the near edge of the fan. Precise, calm,
  intelligent, premium; 50mm, moderate depth of field, fine grain.
- **negative 추가**: `card faces, numbers, charts, graphs, dice`
- **filename**: `public/images/category/data-probability.webp`
- **priority**: P0 · **status**: NOT GENERATED (no image capability in Stage 3 session)

### VA-07 — 포커 개념·문화 (Poker Concepts / Culture)
- **purpose**: 어원·용어·역사. "왜 그렇게 부르나".
- **composition/subject**: 오래된 딜러 버튼(글자 없음, 매끈한 흰 원반) 하나가 펠트 위에 놓이고 뒤로 뒷면
  카드 한 장이 기울어져 있음. 클래식하되 카지노가 아님.
- **generation prompt**: > Square editorial still life: a smooth plain white dealer button with no
  lettering resting on dark charcoal felt, one playing card face down leaning against it, backs
  plain and unmarked. Warm side light like late afternoon through a window, long soft shadow, a
  subtle crimson rim along the button's edge. Timeless, quiet, premium editorial; 85mm, shallow
  depth of field, fine grain.
- **negative 추가**: `text on button, DEALER lettering, casino, vintage grunge`
- **filename**: `public/images/category/concepts-culture.webp`
- **priority**: P0 · **status**: NOT GENERATED (no image capability in Stage 3 session)

## C. 블로그 허브

### VA-08 — 블로그 허브 히어로
- **page/route**: `/blog` 매거진 히어로(`EditorialHero` 비주얼 슬롯)
- **purpose**: 블로그가 "Q&A 부록"이 아니라 에디토리얼 허브라는 첫인상(계약 AF·AG).
- **dimensions**: 1500 × 1000 · **aspect**: 3:2
- **composition**: 넓은 수평. 빈 프라이빗 룸의 테이블 한 대, 의자 하나만 조명 아래. 사람 없음 또는 등을
  보인 실루엣 하나. 스토리가 "시작되기 전"의 무대.
- **subject**: 테이블·의자·펜던트 조명. 카드는 덱 한 벌이 뒷면으로 중앙에.
- **lighting**: 펜던트 하나, 나머지 어둠. 레드는 뒷벽의 가느다란 실용 조명 라인 하나(네온 간판 아님).
- **background**: 어두운 벽, 질감 최소.
- **safe area**: 피사체 x 10–90%, y 10–90%.
- **generation prompt**: > Wide editorial establishing shot, 3:2, an empty private poker room after
  hours: one charcoal-felt table under a single warm pendant lamp, one chair pulled slightly out,
  a deck of cards face down at the centre with plain unmarked backs. No people, or at most one
  figure seen from behind in silhouette at the far edge. A single thin horizontal line of dim
  crimson practical light on the back wall — not a neon sign. Deep charcoal shadows lifted,
  restrained grade, 35–50mm, moderate depth of field, fine grain. Anticipation, premium magazine
  opener.
- **negative 추가**: `neon sign, crowd, dealer, slot machines, faces`
- **exact overlay needed?**: 아니오
- **alt**: `""`
- **filename**: `public/images/editorial/blog-hub-hero.webp`
- **format / budget**: WebP ≤ 200 KB, lazy 아님이지만 `priority` 금지(홈만), `sizes="(min-width: 1024px) 50vw, 100vw"`
- **theme**: 한 벌 공용
- **priority**: P1
- **status**: NOT GENERATED (no image capability in Stage 3 session)
- **연결 WP**: WP-S3-06. 폴백 = 단일 컬럼 타이포그래피 히어로.

## D. 핸드 스토리 히어로 (16:9, 카드 크롭 3:2 파생)

공통: 계약 AN 템플릿의 "Hero editorial visual" 슬롯. **스토리의 카드·보드·액션은 절대 이미지에 넣지
않는다** — Hero hand · FLOP/TURN/RIVER 보드 · 쇼다운은 바로 아래 DOM(`PokerCards`, 계획 `BoardCards`,
`HandTimeline`)이 evaluator 검증값으로 그린다. 이미지는 그 장면의 **감정과 순간**만 맡는다. 제목의
사건(계약 AK)과 이미지의 감정이 어긋나면 안 된다. 치수 1920 × 1080(+ 1200 × 800 카드 크롭), WebP
히어로 ≤ 200 KB · 카드 ≤ 150 KB, lazy, `sizes="(min-width: 1024px) 960px, 100vw"`(본문 폭을 벗어나는
브레이크아웃, 계약 T), alt `""`, 테마 한 벌 공용, 피사체 안전 영역 x 8–92% (3:2 중앙 크롭 보존) · OG 파생용
좌하단 x 4–40% y 78–94%는 저디테일, 연결 WP-S3-08(스토리) + WP-S3-06(템플릿). 파일명
`public/images/stories/<slug>-hero.webp` / `<slug>-card.webp`. 상태 NOT GENERATED.

### VA-09 — (planned) `qq-vs-72o-flop-227` — "72o로 3벳을 콜한다고? 그런데 플랍이 2-2-7이었다"
- **purpose**: 어이없음 → 체념. 히어로가 QQ로 앞섰다가 플랍에 뒤집히는 순간의 표정.
- **composition/subject**: 히어로(플레이어 1명) 클로즈업, 테이블 너머 방금 열린 플랍을 보는 시선(플랍은
  프레임 밖 하단). 눈썹이 살짝 올라간 "정말?"의 표정. 카드는 손 안에 뒷면으로.
- **lighting**: 아래에서 반사된 테이블 광 + 위 키. 레드 림 우측.
- **generation prompt**: > Cinematic editorial close-up, 16:9, a poker player in their late twenties
  staring down at the table just past the bottom of the frame, eyebrows slightly raised in
  disbelief, lips parted — the look of someone who cannot believe what just landed. Two cards
  held face down against the chest, backs plain and unmarked. Warm tungsten key light from above,
  soft bounce from the felt below the chin, a thin crimson rim on the right cheek. Charcoal
  background, shadows lifted, natural skin tone, 85mm, shallow depth of field, fine grain.
  Restrained, premium, slightly dramatic.
- **negative 추가**: `visible card faces, board cards, exaggerated anger, screaming`
- **priority**: **P0** · **status**: NOT GENERATED (no image capability in Stage 3 session)

### VA-10 — (planned) `qq-three-bet-frustration` — "QQ를 들고 3벳했는데 상대 패를 보고 더 화가 났다"
- **purpose**: 이기고도 짜증나는(혹은 지고 더 화나는) 아이러니. 감정은 "화"보다 "허탈한 웃음".
- **composition/subject**: 쇼다운 직후, 히어로가 의자에 등을 기대며 한 손으로 이마를 짚는 제스처, 시선은
  상대 쪽(프레임 밖 좌측). 상대의 손과 뒷면 카드가 좌측 가장자리에 살짝.
- **lighting**: 키 좌상, 레드 림 좌측(상대 방향에서 오는 빛).
- **generation prompt**: > Cinematic editorial medium shot, 16:9, a poker player leaning back in the
  chair after a showdown, one hand pressed to the forehead, a rueful half-laugh, eyes on the
  opponent off-frame left. The opponent's hand and two face-down unmarked cards just enter the
  left edge. Warm key light from upper left, crimson rim from the left, charcoal room falling to
  darkness. Natural skin tones, shadows lifted, 50mm, shallow depth of field, fine grain.
  Irony, not rage; premium, restrained.
- **negative 추가**: `visible card faces, shouting, thrown chips`
- **priority**: **P0** · **status**: NOT GENERATED (no image capability in Stage 3 session)

### VA-11 — (planned) `full-house-loses` — "풀하우스를 만들었는데 내가 진다고?"
- **purpose**: 확신 → 붕괴. 강한 패로 지는 낯선 경험.
- **composition/subject**: 히어로가 칩을 앞으로 밀던 손을 멈춘 순간(손이 칩 더미에 얹혀 있음), 표정은
  굳음. 정면보다 약간 측면. 카드는 테이블 위 뒷면.
- **lighting**: 키 위, 레드 림 뒤쪽(윤곽).
- **generation prompt**: > Cinematic editorial shot, 16:9, a poker player frozen mid-motion with one
  hand resting on a modest stack of generic unmarked dark chips they were about to push forward,
  expression suddenly still, jaw set. Two cards face down on the felt with plain backs. Warm
  tungsten key from above, crimson back-rim outlining the shoulders, charcoal background.
  Natural skin tones, shadows lifted, 50mm, shallow depth of field, fine grain. The moment
  certainty breaks; premium, restrained.
- **negative 추가**: `visible card faces, huge chip towers, cash`
- **priority**: **P0** · **status**: NOT GENERATED (no image capability in Stage 3 session)

### VA-12 — (planned) `river-changes-everything` — "리버 한 장 때문에 모든 게 바뀌었다"
- **purpose**: 마지막 한 장. 시간이 멈춘 느낌.
- **composition/subject**: 딜러의 손이 리버 카드를 **뒷면으로** 펠트 위에 막 놓는 순간의 클로즈업, 배경에
  두 플레이어의 흐릿한 실루엣. 카드 앞면 없음.
- **lighting**: 펜던트 키가 카드와 손만 비춤, 레드 림 카드 모서리.
- **generation prompt**: > Cinematic editorial macro, 16:9, a dealer's hand placing the final card face
  down onto dark charcoal felt, the card's plain unmarked back catching a warm pendant light,
  a thin crimson rim along its edge. Two players are blurred silhouettes deep in the background,
  motionless. Everything else falls into charcoal darkness. 85mm macro, very shallow depth of
  field, fine grain. Suspended time; premium, restrained, slightly dramatic.
- **negative 추가**: `card face, revealed river, faces in focus`
- **priority**: **P0** · **status**: NOT GENERATED (no image capability in Stage 3 session)

### VA-13 — (planned) `aa-loses` — AA 패배 (콘텐츠 감사 §7 S1 후보)
- **purpose**: 최강 패도 진다. 담담한 교훈.
- **composition/subject**: 히어로가 뒷면 카드 두 장을 조용히 덱 쪽으로 밀어 넘기는(머킹) 손 클로즈업,
  얼굴은 프레임 위로 잘림. 손동작이 "받아들임".
- **generation prompt**: > Cinematic editorial close-up, 16:9, a player's hands calmly sliding two
  face-down unmarked cards forward across dark charcoal felt to fold them, the face cropped out
  above the frame. Warm tungsten key from above, a thin crimson rim on the knuckles, charcoal
  background. Composed, accepting, quiet; 85mm, shallow depth of field, fine grain, premium.
- **negative 추가**: `visible card faces, anger`
- **priority**: P1 · **status**: NOT GENERATED (no image capability in Stage 3 session)

### VA-14 — (planned) `ak-flop-miss` — AK 플랍 미스 (콘텐츠 감사 §7 S1 후보)
- **purpose**: 기대와 어긋남. "좋은 패였는데 아무것도 안 맞았다."
- **composition/subject**: 히어로가 팔짱을 끼고 테이블을 내려다보는 상반신, 표정은 고민. 플랍은 프레임
  밖. 카드는 테이블 위 뒷면.
- **generation prompt**: > Cinematic editorial medium shot, 16:9, a poker player with arms crossed
  looking down at the table past the bottom edge of the frame, thinking hard, lips pressed. Two
  cards face down on the felt with plain backs. Warm key from above, crimson rim on the left
  shoulder, charcoal room. Natural skin tones, 50mm, shallow depth of field, fine grain.
  Deliberation; premium, restrained.
- **negative 추가**: `visible card faces, board cards`
- **priority**: P1 · **status**: NOT GENERATED (no image capability in Stage 3 session)

## E. 허브 · 정적 페이지

### VA-15 — Learn 허브 히어로
- **page/route**: `/learn` (`EditorialHero` 비주얼 슬롯)
- **purpose**: "처음부터 배우기"의 분위기 — 카지노가 아니라 **공부하는 테이블**.
- **dimensions**: 1500 × 1000 · **aspect**: 3:2
- **composition/subject**: 책상 위에 뒷면 카드 몇 장, 열린 노트(빈 페이지, 글자 없음), 연필, 머그. 위에서
  내려다본 45° 구도. 사람은 손만.
- **lighting**: 창가의 부드러운 주광 + 스탠드 하나. 레드는 연필 또는 머그 한 점.
- **background**: 어두운 원목/차콜 책상.
- **safe area**: x 10–90%, y 10–90%.
- **generation prompt**: > Editorial overhead-angle still, 3:2, a study desk at night: a few playing
  cards face down with plain unmarked backs, an open notebook with blank pages, a pencil, a
  ceramic mug, one hand resting at the edge of the notebook. Soft warm desk lamp light from the
  upper left, a single crimson accent object (the pencil), dark charcoal desk surface. Calm,
  focused, friendly, premium; 50mm, moderate depth of field, fine grain.
- **negative 추가**: `handwriting, text on pages, charts, laptop screen with content, card faces`
- **exact overlay needed?**: 아니오 · **alt**: `""`
- **filename**: `public/images/editorial/learn-hub-hero.webp`
- **format / budget**: WebP ≤ 200 KB, `sizes="(min-width: 1024px) 50vw, 100vw"`
- **theme**: 한 벌 공용 · **priority**: P1
- **status**: NOT GENERATED (no image capability in Stage 3 session)
- **연결 WP**: WP-S3-09. 폴백 = 단일 컬럼 히어로.

### VA-16 — Tools 허브 히어로
- **page/route**: `/tools`
- **purpose**: "계산기 모음"의 정밀함. 단 generic SaaS 대시보드로 보이면 안 된다(계약 R).
- **dimensions**: 1500 × 1000 · **aspect**: 3:2
- **composition/subject**: 추상에 가까운 매크로 — 뒷면 카드의 모서리들이 정확한 간격으로 겹친 패턴, 혹은
  칩 한 개의 가장자리 매크로. 사람 없음.
- **lighting**: 쿨-뉴트럴 키, 레드 림 한 줄.
- **generation prompt**: > Abstract editorial macro, 3:2: the corners of several playing cards face
  down with plain unmarked backs, overlapped at perfectly even intervals on dark charcoal felt so
  the edges form a clean stepped rhythm. Cool neutral overhead light, a single thin crimson rim
  along one edge. Precise, minimal, intelligent, premium; 100mm macro, shallow depth of field,
  fine grain.
- **negative 추가**: `card faces, UI, screens, charts, calculators, numbers`
- **exact overlay needed?**: 아니오 · **alt**: `""`
- **filename**: `public/images/editorial/tools-hub-hero.webp`
- **format / budget**: WebP ≤ 200 KB · **theme**: 한 벌 공용 · **priority**: P2 (허브는 데이터 프리뷰
  `HomeRangePreview`류로 충분할 수 있음 — WP-S3-14가 판단)
- **status**: NOT GENERATED (no image capability in Stage 3 session)
- **연결 WP**: WP-S3-14

### VA-17 — About 히어로 (정물, 사람 없음)
- **page/route**: `/about`
- **purpose**: 신뢰 페이지. "숫자는 어떻게 계산하는가"의 분위기. 계약 BH — 가짜 팀/인물 금지이므로 **사람
  없음**.
- **dimensions**: 1500 × 1000 · **aspect**: 3:2
- **composition/subject**: 책상 위 정물 — 뒷면 카드 한 벌을 가지런히 쌓은 덱, 빈 모눈종이, 자, 연필.
  질서·검증의 느낌.
- **lighting**: 부드러운 주광 느낌, 레드는 연필 한 자루.
- **background**: 차콜 책상.
- **safe area**: x 10–90%, y 10–90%.
- **generation prompt**: > Editorial still life, 3:2, on a dark charcoal desk: a neatly squared deck
  of playing cards face down with plain unmarked backs, a sheet of blank grid paper with no
  writing, a steel ruler and a single red pencil. Soft neutral daylight from the left, long
  gentle shadows, one crimson accent only (the pencil). Orderly, honest, calm, premium; 50mm,
  moderate depth of field, fine grain. No people.
- **negative 추가**: `people, hands, handwriting, text, charts, laptop, office`
- **exact overlay needed?**: 아니오 · **alt**: `""`
- **filename**: `public/images/editorial/about-hero-desk.webp`
- **format / budget**: WebP ≤ 200 KB · **theme**: 한 벌 공용 · **priority**: P1
- **status**: NOT GENERATED (no image capability in Stage 3 session)
- **연결 WP**: WP-S3-15

### VA-18 — 404 아트
- **page/route**: `not-found` (로케일 404)
- **purpose**: "이 페이지는 없다"를 브랜드답게. 숫자 404·문구는 DOM.
- **dimensions**: 1000 × 1000 · **aspect**: 1:1
- **composition/subject**: 빈 의자 하나가 조명 아래, 테이블 위에는 뒷면 카드 한 장이 반쯤 레일 밖으로.
  사람 없음.
- **lighting**: 펜던트 하나, 레드 림 의자 등받이.
- **background**: 어둠.
- **safe area**: 피사체 x 15–85%, y 15–85%.
- **generation prompt**: > Square editorial still, an empty chair at a dark charcoal-felt poker table
  under a single warm pendant light, one playing card face down with a plain unmarked back
  hanging halfway off the padded rail. Thin crimson rim light on the chair back, everything else
  charcoal darkness. Wry, quiet, premium; 50mm, moderate depth of field, fine grain. No people.
- **negative 추가**: `people, card face, numbers, signage`
- **exact overlay needed?**: 아니오 · **alt**: `""`
- **filename**: `public/images/editorial/not-found-empty-seat.webp`
- **format / budget**: WebP ≤ 100 KB, lazy, `sizes="(min-width: 640px) 320px, 60vw"`
- **theme**: 한 벌 공용 · **priority**: P1
- **status**: NOT GENERATED (no image capability in Stage 3 session)
- **연결 WP**: WP-S3-15 (404 visual consistency). 폴백 = kind 선화 또는 타이포그래피만.

## F. 배경 텍스처 (전면 배경 — 두 벌 필요, P2)

프레임이 없는 전면 배경이라 SG §6의 예외다. `Section` 배경 변형에 CSS `background-image`로 깔리며
`next/image`를 쓰지 않는다. **라이트 벌이 성립하지 않으면 도입 취소**(WP6 §9-5 (5) 유지). 그 위 텍스트는
`scrim-900` 없이도 토큰 대비를 유지해야 하므로 텍스처의 명도 편차는 매우 작아야 한다(추상·저대비).

### VA-19 — 추상 차콜 펠트 텍스처
- **page/route**: `/` FAQ·Glossary 섹션 등 `Section` 배경 변형; 허브 섹션 배경
- **purpose**: 섹션 리듬용 질감(계약 S "Section background variation").
- **dimensions**: 1920 × 1080 × 2벌 · **aspect**: 16:9 (`background-size: cover`)
- **composition/subject**: 펠트 섬유의 매크로. 오브젝트 없음, 선 없음(WP6 §9-5 — 전경 선화와 경쟁 금지).
- **lighting/background**: 다크 벌 = `#0b0d10`~`#14181f` 사이의 미세 편차. 라이트 벌 = `#eef1f5`~`#f6f8fb`.
- **safe area**: 해당 없음(균질).
- **generation prompt**: > Seamless abstract macro texture of fine charcoal felt fabric, extremely low
  contrast, no objects, no lines, no pattern, uniform soft fibre grain, colour between very dark
  charcoal and near-black. (라이트 벌: same texture in pale cool grey between off-white and light
  grey, very low contrast.)
- **negative 추가**: `objects, lines, seams, logos, gradients to black, high contrast`
- **exact overlay needed?**: 아니오 · **alt**: 해당 없음(CSS 배경)
- **filename**: `public/images/texture/felt-dark.webp`, `public/images/texture/felt-light.webp`
- **format / budget**: WebP 벌당 ≤ 120 KB · **theme**: **두 벌**, `[data-theme]`/미디어 쿼리로 스왑
- **priority**: P2 · **status**: NOT GENERATED (no image capability in Stage 3 session)
- **연결 WP**: WP-S3-05 (홈), 이후 허브 WP

### VA-20 — 브랜드 레드 애트모스피어 (Final CTA 배경)
- **page/route**: `/` 11 Final CTA 배경
- **purpose**: 마지막 CTA에만 허용되는 "slightly dramatic" 한 번. 레드가 화면의 주인공이 되는 유일한 자리.
- **dimensions**: 1920 × 1080 × 2벌 · **aspect**: 16:9
- **composition/subject**: 어두운 공간에 붉은 빛이 안개처럼 번지는 추상. 오브젝트·사람·선 없음.
- **lighting**: 좌하단에서 번지는 `#d71e36` 대역 빛, 나머지 `#090a0d`. 라이트 벌은 `#f2f4f7` 위에 `#c2183a`
  10% 미만의 옅은 번짐.
- **safe area**: 중앙 x 20–80%, y 25–75%는 저디테일(CTA 텍스트가 DOM으로 올라감 — 배경 명도가 토큰 대비를
  깨면 안 되므로 이 영역은 거의 단색).
- **generation prompt**: > Abstract atmospheric background, 16:9: near-black charcoal space with a soft
  diffuse crimson glow bleeding in from the lower-left corner like light through haze, the centre
  of the frame almost uniform dark charcoal. No objects, no lines, no lens flare, no particles,
  very smooth gradients, subtle film grain. (라이트 벌: pale cool off-white space with a faint
  warm crimson wash in the lower-left corner, centre almost uniform off-white.)
- **negative 추가**: `lens flare, particles, smoke shapes, neon, objects, people, banding`
- **exact overlay needed?**: 아니오 · **alt**: 해당 없음(CSS 배경)
- **filename**: `public/images/texture/cta-red-dark.webp`, `public/images/texture/cta-red-light.webp`
- **format / budget**: WebP 벌당 ≤ 120 KB · **theme**: **두 벌** · **priority**: P2
- **status**: NOT GENERATED (no image capability in Stage 3 session)
- **연결 WP**: WP-S3-05

### VA-21 — 초보자 실수 시리즈 에디토리얼 히어로 (개별 글용, 선택)
- **page/route**: `/blog/<slug>` (contentType = 초보자 실수) 히어로
- **purpose**: 실수 글이 늘어나면 카테고리 아트(VA-05) 하나로는 카드가 전부 같아진다. 시리즈용 16:9 한 장.
- **dimensions**: 1920 × 1080 (+1200 × 800 카드) · **aspect**: 16:9
- **composition/subject**: 히어로가 칩을 던지듯 밀어 넣는 손과 흔들리는 칩 더미, 얼굴은 프레임 위로 잘림.
  "성급함".
- **generation prompt**: > Cinematic editorial close-up, 16:9, a player's hands hastily shoving a small
  stack of generic unmarked dark chips forward on charcoal felt, the stack tilting, face cropped
  out above the frame. Warm key from above, crimson rim on the wrist, charcoal background;
  50mm, shallow depth of field, fine grain. Impulsive, gently humorous, premium, restrained.
- **negative 추가**: `chip denominations, cash, card faces, anger`
- **exact overlay needed?**: 아니오 · **alt**: `""`
- **filename**: `public/images/editorial/beginner-mistakes-series-hero.webp` (+ `-card.webp`)
- **format / budget**: WebP ≤ 200 KB / ≤ 150 KB · **theme**: 한 벌 공용 · **priority**: P2
- **status**: NOT GENERATED (no image capability in Stage 3 session)
- **연결 WP**: WP-S3-07

## G. OG 시스템 (1200 × 630 PNG, 페이지 이미지와 별도 — 계약 BU)

**권고: 런치는 기존 정적 1장(VA-22)으로 충분하다.** 근거 — (1) 소셜·카카오톡 미리보기는 `og:title`을
텍스트로 함께 렌더하므로 카드가 벌어들이는 것은 "주제 식별"뿐이다(WP6 §4-0). (2) 현재 `og.png`는 이미
3BETTILT 워드마크 + 13×13 차트로 리브랜드돼 있고 1200×630, 다크, 워드마크 외 텍스트 0이다(WP-S3-01b
마스터 검증). (3) 런치 시점에 페이지별 OG를 만들 코드(`opengraph-image` 0건)가 없다. 런치 후 첫
사이클(P1)에 **핸드 스토리 6장**을 히어로 크롭 + 워드마크로 파생한다 — 스토리가 공유되는 콘텐츠다.
kind×topic 32장(WP6 권고안 A)은 그 다음(P2)이며, AI가 아니라 `ContentThumbnail` 선화를 스크립트로 굽는다.
모든 OG는 **다크 고정**(테마 무관), 파일명 slug 기반, 텍스트는 워드마크뿐, `og:image:alt`는 메타데이터로.

### VA-22 — 기본 OG 카드 (전 페이지 폴백) — **EXISTS**
- **page/route**: 전 페이지 기본 `og:image`
- **purpose**: 브랜드 카드. 페이지별 OG가 없는 모든 라우트.
- **dimensions**: 1200 × 630 · **aspect**: 1.905:1 · **composition**: 좌측 `3BETTILT` 워드마크 + 레드
  밑줄, 우측 13×13 격자에 레드 채움(현재 파일 육안 확인). 다크 `#090a0d` 바탕, 1px 패널 테두리.
- **subject/lighting/background**: 벡터. 조명 없음.
- **safe area**: 해당 없음.
- **generation prompt**: 해당 없음(SVG/스크립트 산출물). **AI 생성 금지.**
- **negative**: 워드마크 외 텍스트 금지, 한국어 제목 래스터화 금지.
- **exact overlay needed?**: 격자는 장식이며 특정 레인지를 주장하지 않는다(임의 채움처럼 보이면 안 되므로,
  재생성 시 `HomeHeroVisual`과 같은 실제 `resolveRange` 결과를 쓰거나 지금처럼 "레인지가 아닌 대각선
  패턴"임을 유지 — 둘 중 하나로 통일. 현재 파일은 상단 우측이 채워진 형태로 실제 레인지처럼 보이므로
  **P1에서 실제 학습용 기본 레인지로 재생성하는 것을 권고**).
- **alt** (`og:image:alt`): 현재 값 유지("3BetTilt 워드마크와 13×13 핸드레인지 차트" 계열 — `metadata.ts`가 진실)
- **filename**: `public/og.png` (기존, 이동 금지)
- **format / budget**: PNG ≤ 150 KB (현재 파일은 예산 안 — 실측은 STATE의 11.7 KB)
- **theme**: 다크 고정 · **priority**: **P0 (존재)**
- **status**: EXISTS (WP-S3-01b). 재생성 P1 권고만.
- **연결 WP**: WP-S3-16

### VA-23 ~ VA-28 — 핸드 스토리 OG 6장 (파생, AI 생성 아님)
- **page/route**: `/blog/<story-slug>` 6편 (VA-09~14 순서대로 VA-23~28)
- **purpose**: 공유 시 스토리별 주제 식별.
- **dimensions**: 1200 × 630 · **composition**: 해당 스토리 히어로(16:9)를 중앙 크롭(16:9 → 1.905:1은 상하
  각 3.3% 잘림) + 좌하단 `3BETTILT` 워드마크 + 레드 밑줄(VA-22와 동일 위치·크기) + 워드마크 뒤 국소 스크림.
  **제목·덱·카드는 넣지 않는다**(`og:title`이 나른다; 카드는 AI 이미지 사실 문제).
- **safe area**: 워드마크 존 x 4–40%, y 78–94% — 히어로의 이 영역이 저디테일이어야 한다(§D 공통).
- **generation prompt**: 해당 없음. `sharp`/`resvg` 계열 스크립트로 결정적 합성(WP6 §4 파이프라인 재사용).
- **alt** (`og:image:alt`): "3BetTilt 핸드 스토리 — <스토리 H1>" 형태를 메타데이터로.
- **filename**: `public/og/stories/<slug>.png`
- **format / budget**: PNG ≤ 150 KB · **theme**: 다크 고정 · **priority**: P1
- **status**: NOT GENERATED (no image capability in Stage 3 session; 히어로 VA-09~14 선행)
- **연결 WP**: WP-S3-16 (메타데이터), 스크립트는 WP-S3-08 또는 S3-16

### VA-29 — kind × topic OG 32장 (스크립트 생성, AI 아님)
- **page/route**: learn 15 · blog(비스토리) · glossary 58 · hands 20 — `topic`을 가진 모든 레코드
- **purpose**: 피드에서 "레인지 얘기 / 확률 얘기"가 0.2초에 읽히게. WP6 §4-1 권고안 A 그대로.
- **dimensions**: 1200 × 630 · **composition**: `ground-900` 바탕 + 워드마크 + `ContentThumbnail`의 topic
  8종 선화를 큰 스케일로, kind 4종 액센트색. 텍스트 0(워드마크 제외).
- **generation prompt**: 해당 없음. 선화 원본은 `ContentThumbnail.tsx`에서 데이터 모듈로 추출해 한 벌만
  유지(WP6 §4-1 [2]). 팔레트는 `globals.css`와 대조 테스트.
- **alt**: "3BetTilt — <kind 라벨> · <topic 라벨>" 메타데이터.
- **filename**: `public/og/<kind>-<topic>.png` (예 `blog-odds.png`, `learn-range.png`)
- **format / budget**: PNG 장당 ≤ 150 KB(실제로는 훨씬 작을 것이나 측정 전 숫자 기록 금지) · **theme**: 다크 고정
- **priority**: P2 · **status**: NOT GENERATED (no image capability in Stage 3 session)
- **연결 WP**: WP-S3-16

---

## H. Owner 실행 체크리스트

1. **생성 도구**: 사진적 에디토리얼을 낼 수 있는 이미지 모델이면 무엇이든(특정 벤더 요구 없음). 각 항목의
   프롬프트 + SG §10 네거티브 블록을 그대로 쓴다. 항목당 후보 4~8장을 뽑고 SG §11 수용 검사로 고른다.
   **카드 앞면이 조금이라도 읽히면 탈락.** 글자가 보이면 탈락.
2. **마스터 크기**: 항목의 치수 이상으로 생성(또는 업스케일)한 뒤 정확한 비율로 크롭. 파생 크롭(3:2 카드,
   OG)은 원본에서 다시 자른다 — 축소본에서 자르지 않는다.
3. **변환**: WebP q≈80(`cwebp -q 80` 또는 `sharp`). 예산 초과 시 q를 내리거나 긴 변을 줄인다. OG는 PNG.
4. **검증(실측만 기록)**: `sips -g pixelWidth -g pixelHeight <file>` 또는 `identify`, `ls -l`. 두 테마
   스크린샷(390px · 1280px)으로 프레임 경계·안전 영역·레드 예산 확인.
5. **배치**: `apps/fishtilt/public/images/{editorial,category,stories,texture}/…`, OG는
   `apps/fishtilt/public/og/…`. 파일명은 이 문서 그대로. `apps/fishtilt/public/images/CREDITS.md`에
   파일명·모델·버전·프롬프트·생성일 기록.
6. **연결**: 자산이 들어오는 커밋에서 해당 WP가 `EditorialImage`/히어로 호출부에 `src`를 넘기고, 디스크
   대조 테스트(레코드↔파일 양방향 고아 검출, WP6 §7 규약)를 같이 넣는다. `next/image`에 `width/height` +
   `sizes` 명시, `priority`는 VA-01만.
   - WP-S3-05: VA-01(+오버레이 좌표), VA-02, VA-19, VA-20
   - WP-S3-06: VA-03~07, VA-08, 스토리 템플릿 히어로 슬롯
   - WP-S3-07: VA-21
   - WP-S3-08: VA-09~14 (슬러그 확정 후 파일명 동기화)
   - WP-S3-09: VA-15 · WP-S3-14: VA-16 · WP-S3-15: VA-17, VA-18
   - WP-S3-16: VA-22 재생성(선택), VA-23~28, VA-29
   - WP-S3-17: 이미지 페이로드·LCP·CLS 실측(이미지 도입 전후 비교, 숫자는 측정값만)
7. **금지**: 원본 수 MB를 그대로 커밋하지 않는다. 저품질 임시 이미지를 "완료"로 표시하지 않는다.
   이미지 없는 슬롯은 아래 폴백 표대로 두면 된다.

## I. Fallback 상태표 — 자산이 하나도 생성되지 않았을 때 런치 화면

| 슬롯 | 런치 시 보이는 것 | 깨지는가 | 위험 |
|---|---|---|---|
| 홈 히어로 (VA-01) | `HomeHeroVisual` — 실제 카드 2장 + 실제 13×13 (데이터 기반) | 아니오 | **높음** — 계약 AD/Z의 "프리미엄 에디토리얼 비주얼"이 빠진다. 사이트 첫인상이 Stage 2와 같다 |
| 홈 Stories 피처드 (VA-02) | 스토리 히어로 → 카테고리 아트 → `ContentThumbnail(blog, topic)` 16:5 선화를 3:2/16:9 박스 중앙에 | 아니오 | 중간 |
| 블로그 카테고리 내비 (VA-03~07) | kind 액센트 선화 1:1 박스 | 아니오 | **높음** — 다섯 카테고리가 시각적으로 구분되지 않아 매거진 허브가 "카드 벽"으로 회귀 |
| 블로그 허브 히어로 (VA-08) | 단일 컬럼 타이포그래피 히어로 | 아니오 | 낮음 |
| 핸드 스토리 히어로 (VA-09~14) | 카테고리 아트(없으면 선화) — 6편 모두 같은 그림 | 아니오 | **높음** — 핵심 editorial pillar의 스토리 6편이 동일한 히어로를 갖는다 |
| 검색 가이드·기타 블로그 히어로 | 카테고리 아트 → 선화 | 아니오 | 낮음(도해가 본체) |
| Learn 허브 히어로 (VA-15) | 단일 컬럼 히어로 + 로드맵 | 아니오 | 낮음 |
| Tools 허브 히어로 (VA-16) | 단일 컬럼 히어로 또는 데이터 프리뷰 | 아니오 | 낮음 |
| About 히어로 (VA-17) | 단일 컬럼 히어로 | 아니오 | 낮음 |
| 404 (VA-18) | 타이포그래피 + kind 선화 | 아니오 | 낮음 |
| 섹션 텍스처·CTA 배경 (VA-19·20) | 토큰 단색 배경(`Section` 변형) | 아니오 | 없음 |
| OG (VA-22) | 기존 `public/og.png` 전 페이지 | 아니오 | 없음(런치 충분) |
| 스토리 OG (VA-23~28) | `public/og.png` | 아니오 | 낮음 |
| kind×topic OG (VA-29) | `public/og.png` | 아니오 | 낮음 |

가장 위험한 세 슬롯: **VA-01 홈 히어로 · VA-03~07 카테고리 아트 · VA-09~12 스토리 히어로** — 전부 P0이며,
이 셋이 없으면 Stage 3의 "에디토리얼" 약속이 화면에서 증명되지 않는다. 그 외는 없어도 Stage 3의 정보
구조·정확성·성능에 영향이 없다.
