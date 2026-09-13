# 3BetTilt Images — 01. 원본 분류 · 가공 파이프라인 · 전체 자산 표

## 원본 수량 불일치 (중요)

지시서는 원본 **31장**(GROUP A 17장)을 전제로 했지만, `visual-source-temp/`에 실제로 있는 PNG는 **28장**이다.

| 그룹 | 생성 시각 | 지시서 | 실제 |
| --- | --- | --- | --- |
| A · BRAND/STATIC | 06:49 ~ 07:10 | 17 | **14** (06:49~06:50 세로형 6장 + 07:10 가로형 8장) |
| B · CATEGORY | 07:41 | 8 | 8 |
| C · STORY | 11:53 | 6 | 6 |
| 합계 | | 31 | **28** |

숨김 파일, 하위 폴더, 시스템 전체 검색(`ChatGPT Image 2026*`)에서도 나머지 3장은 찾지 못했다. 28장 전부를 사용했고
미사용은 0장이다. 빠진 3장이 있다면 `editorial-images.manifest.json`에 행을 추가하고 스크립트를 다시 돌리면 된다(02 보고서의 슬롯 추가 절차 참고).

## 원본 안전

- 원본은 **읽기만** 했다. 작업 전/후 `shasum` 28개가 동일하다(수정·rename·삭제 없음).
- `/visual-source-temp/`를 루트 `.gitignore`에 추가했다 — `git status --ignored` → `!! visual-source-temp/`.
- 원본 PNG는 `public/`에 복사하지 않았다. 배포 폴더에는 가공한 JPEG만 있다.

## 처리 스크립트

- **위치:** `apps/fishtilt/scripts/process-editorial-images.mjs`
- **매핑:** `apps/fishtilt/scripts/editorial-images.manifest.json` (행 1개 = source → crop → resize → JPEG 1단계)
- **실행:** `node apps/fishtilt/scripts/process-editorial-images.mjs [--source <dir>] [--only <file.jpg>] [--dry-run] [--report <json>]`
- **sharp:** 앱 의존성을 **추가하지 않았다**. Next가 이미지 최적화용으로 들고 있는 `sharp@0.35.4`를
  `createRequire(require.resolve('next/package.json'))`로 가져온다.
- **crop:** 목표 비율에서 가장 큰 박스 → `zoom`(≥1)으로 축소 → `focus`(0~1)를 중심으로 프레임 안에 고정.
- **resize:** `output` 크기로 lanczos3. **encode:** JPEG q78, mozjpeg, progressive, **4:4:4** chroma, 메타데이터 제거.
- **검증 내장:** 모든 PNG가 정확히 한 번씩 매핑됐는지, 출력 이름이 중복되지 않는지 확인한다. 미매핑 원본이 있으면 exit 1.
  macOS의 한글 NFD 파일명은 NFC로 비교한다.
- **톤·텍스트 굽지 않음:** 밝기, 불투명도, 오버레이, 글자를 파일에 넣지 않는다. 오버레이는 CSS 변수 몫이다(02 보고서).

### 품질 결정

q74 / 4:2:0으로 시작했더니 어두운 붉은 연기와 그라데이션에서 8×8 블록 노이즈가 보였다(1:1 확대로 확인).
q78 / 4:4:4로 올리니 블록이 사라졌고, 용량은 76~201KB로 목표(대부분 100~250KB, 100KB 이하 허용) 안에 들어왔다.

### 크기 결정

| 슬롯 | 출력 | 근거 |
| --- | --- | --- |
| theme / story (16:9) | 1920×1080 | 지시서 규격. 원본 1672×941 → ×1.15 |
| home-hero (4:5) | 1120×1400 | 원본 1122×1402가 이미 4:5. 표시 폭 480px(2x=960)이면 충분해서 1600×2000으로 올리지 않았다(지시서의 "필요하면" 조항) |
| home-breathing · brand-feature (21:9) | 2400×1028 | 지시서 규격. 폭 1248px 밴드 / 풀폭 밴드. 원본 폭 1672 → ×1.44 확대 |
| home roadmap · about-table (21:9) | 1680×720 | 표시 폭 384~720px. 확대 없음 |
| 허브 hero (3:2) | 1200×800 | split hero 오른쪽 열 약 520px |
| brand-about (16:9) | 1280×720 | 읽기 폭 720px. 세로 원본에서 잘라서 확대는 ×1.14뿐 |

썸네일용 사본은 만들지 않았다. 카드와 목록은 `next/image`의 `sizes`/`srcset`이 줄여서 보낸다.

### Crop 조정 (눈검수 후)

- `brand-hands`: focus y 0.45 → 0.36 (정수리가 잘려서)
- `theme-range`: zoom 1.25, focus (0.44, 0.42) — 오른쪽 아래 격자형 종이(레인지 표처럼 보임)를 대부분 잘라냄
- `brand-feature` ↔ `brand-about-table` 원본 교체: 풀폭 CTA 밴드가 얇아서 cover crop이 인물 상반신 가운데로 떨어졌다.
  칩을 쌓는 손 사진(07_10_10 (6))은 띠 모양으로 잘려도 자연스러워서 CTA로 보내고, 두 사람 장면(07_10_11 (8))은 About 21:9로 보냈다.

## 전체 원본 표 (28)

| # | source filename (`ChatGPT Image 2026년 9월 13일 오후 …`) | timestamp group | final filename | role | page / category / story assignment | crop ratio | final dimensions | original filesize | final filesize |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `…06_49_34.png` | A · BRAND/STATIC (06:49–07:10) | `home-hero.jpg` | Home hero (4:5, five code-drawn cards overlaid in the bottom band) | / — EditorialHero visual (HomeHeroVisual) | 4:5 | 1120×1400 | 1.54 MB | 110 KB |
| 2 | `…06_49_53.png` | A · BRAND/STATIC (06:49–07:10) | `brand-hands.jpg` | Hands hub hero visual | /hands — EditorialHero visual | 3:2 | 1200×800 | 1.52 MB | 76 KB |
| 3 | `…06_50_02 (1).png` | A · BRAND/STATIC (06:49–07:10) | `brand-blog.jpg` | Blog hub hero visual | /blog — EditorialHero visual | 3:2 | 1200×800 | 1.75 MB | 78 KB |
| 4 | `…06_50_03 (2).png` | A · BRAND/STATIC (06:49–07:10) | `brand-practice.jpg` | Practice (quiz) hub hero visual | /practice — EditorialHero visual | 3:2 | 1200×800 | 1.75 MB | 85 KB |
| 5 | `…06_50_03 (3).png` | A · BRAND/STATIC (06:49–07:10) | `brand-about.jpg` | About hero visual | /about — PageHero visual | 16:9 | 1280×720 | 1.83 MB | 86 KB |
| 6 | `…06_50_04 (4).png` | A · BRAND/STATIC (06:49–07:10) | `brand-tools.jpg` | Tools hub hero visual (desktop only) | /tools — PageHero visual | 3:2 | 1200×800 | 1.79 MB | 85 KB |
| 7 | `…07_10_08 (1).png` | A · BRAND/STATIC (06:49–07:10) | `home-breathing.jpg` | Home breathing band (21:9, statement over a side scrim) | / — HomeBreathing | 21:9 | 2400×1028 | 1.51 MB | 165 KB |
| 8 | `…07_10_09 (2).png` | A · BRAND/STATIC (06:49–07:10) | `home-stage-rules.jpg` | Home roadmap — stage 1 picture | / — HomeRoadmap stage-rules | 21:9 | 1680×720 | 1.63 MB | 107 KB |
| 9 | `…07_10_09 (3).png` | A · BRAND/STATIC (06:49–07:10) | `brand-learn.jpg` | Learn hub hero visual | /learn — PageHero visual | 3:2 | 1200×800 | 1.54 MB | 82 KB |
| 10 | `…07_10_09 (4).png` | A · BRAND/STATIC (06:49–07:10) | `home-stage-postflop-math.jpg` | Home roadmap — stage 3 picture | / — HomeRoadmap stage-postflop-math | 21:9 | 1680×720 | 1.56 MB | 96 KB |
| 11 | `…07_10_10 (5).png` | A · BRAND/STATIC (06:49–07:10) | `home-stage-range-position.jpg` | Home roadmap — stage 2 picture | / — HomeRoadmap stage-range-position | 21:9 | 1680×720 | 1.77 MB | 119 KB |
| 12 | `…07_10_10 (6).png` | A · BRAND/STATIC (06:49–07:10) | `brand-feature.jpg` | Home closing call-to-action band backdrop | / — CtaBand backdrop | 21:9 | 2400×1028 | 1.53 MB | 151 KB |
| 13 | `…07_10_10 (7).png` | A · BRAND/STATIC (06:49–07:10) | `brand-glossary.jpg` | Glossary hub hero visual | /glossary — PageHero visual | 3:2 | 1200×800 | 1.55 MB | 77 KB |
| 14 | `…07_10_11 (8).png` | A · BRAND/STATIC (06:49–07:10) | `brand-about-table.jpg` | About — editorial figure between sections | /about — figure before “숫자는 어떻게 계산하는가?” | 21:9 | 1680×720 | 1.56 MB | 102 KB |
| 15 | `…07_41_38 (1).png` | B · CATEGORY (07:41) | `theme-basics.jpg` | Theme — basics (empty table before the game) | theme basics: lessons game-start, glossary game, topic rules | 16:9 | 1920×1080 | 1.37 MB | 101 KB |
| 16 | `…07_41_38 (2).png` | B · CATEGORY (07:41) | `theme-rankings.jpg` | Theme — rankings (deck macro) | theme rankings: lessons hand-rankings, glossary hand-rankings, topic hand-strength | 16:9 | 1920×1080 | 1.92 MB | 201 KB |
| 17 | `…07_41_38 (3).png` | B · CATEGORY (07:41) | `theme-starting-hands.jpg` | Theme — starting hands (two hole cards under a hand) | theme starting-hands: lessons/glossary starting-hands, all /hands pages | 16:9 | 1920×1080 | 1.75 MB | 145 KB |
| 18 | `…07_41_39 (4).png` | B · CATEGORY (07:41) | `theme-range.jpg` | Theme — range (notebook, study desk) | theme range: lessons range, topic range | 16:9 (zoom 1.25) | 1920×1080 | 1.80 MB | 173 KB |
| 19 | `…07_41_39 (5).png` | B · CATEGORY (07:41) | `theme-position.jpg` | Theme — position (top-down table and seats) | theme position: lessons/glossary position, topic position | 16:9 | 1920×1080 | 1.75 MB | 155 KB |
| 20 | `…07_41_39 (6).png` | B · CATEGORY (07:41) | `theme-betting.jpg` | Theme — betting (hand pushing chips) | theme betting: lessons/glossary betting, topic betting | 16:9 | 1920×1080 | 1.48 MB | 123 KB |
| 21 | `…07_41_40 (7).png` | B · CATEGORY (07:41) | `theme-math.jpg` | Theme — math (player thinking, abstract charts) | theme math: lessons/glossary math, topics odds and equity | 16:9 | 1920×1080 | 1.52 MB | 82 KB |
| 22 | `…07_41_40 (8).png` | B · CATEGORY (07:41) | `theme-story.jpg` | Theme — story (two players, late-night room) | theme story: hand-story fallback behind each story's own picture | 16:9 | 1920×1080 | 1.52 MB | 116 KB |
| 23 | `…11_53_15 (1).png` | C · STORY (11:53) | `story-qq-vs-72o-flop-227.jpg` | Hand story — unexpected flop, hand over mouth | blog-qq-vs-72o-flop-227 | 16:9 | 1920×1080 | 1.48 MB | 104 KB |
| 24 | `…11_53_15 (2).png` | C · STORY (11:53) | `story-full-house-loses.jpg` | Hand story — slumped back after the loss | blog-full-house-loses | 16:9 | 1920×1080 | 1.51 MB | 110 KB |
| 25 | `…11_53_15 (3).png` | C · STORY (11:53) | `story-qq-three-bet-frustration.jpg` | Hand story — arms crossed, glaring at the opponent | blog-qq-three-bet-frustration | 16:9 | 1920×1080 | 1.47 MB | 94 KB |
| 26 | `…11_53_15 (4).png` | C · STORY (11:53) | `story-river-changes-everything.jpg` | Hand story — the dealer lays the last card | blog-river-changes-everything | 16:9 | 1920×1080 | 1.46 MB | 126 KB |
| 27 | `…11_53_15 (5).png` | C · STORY (11:53) | `story-aa-loses.jpg` | Hand story — eyes closed, pushing the cards away | blog-aa-loses | 16:9 | 1920×1080 | 1.49 MB | 116 KB |
| 28 | `…11_53_15 (6).png` | C · STORY (11:53) | `story-ak-flop-miss.jpg` | Hand story — head in hand, fingering chips after the flop | blog-ak-flop-miss | 16:9 | 1920×1080 | 1.44 MB | 87 KB |

### 카테고리 매칭 근거 (GROUP B)

| 테마 | 원본 | 장면 |
| --- | --- | --- |
| basics | 07_41_38 (1) | 펜던트 조명 아래 게임 전 빈 테이블 |
| rankings | 07_41_38 (2) | 카드 덱 매크로(뒷면 패턴)와 칩 |
| starting-hands | 07_41_38 (3) | 손 옆에 뒷면으로 놓인 홀카드 두 장 |
| range | 07_41_39 (4) | 노트·연필·카드 한 벌이 놓인 공부 책상 |
| position | 07_41_39 (5) | 위에서 본 6석 테이블과 딜러 버튼 |
| betting | 07_41_39 (6) | 칩을 앞으로 미는 손 |
| math | 07_41_40 (7) | 턱을 괸 사색 + 흐릿한 추상 그래프 |
| story | 07_41_40 (8) | 심야 룸에서 마주 앉은 두 플레이어 |

### 스토리 매칭 근거 (GROUP C)

| 글 | 원본 | 감정 / 장면 |
| --- | --- | --- |
| qq-vs-72o-flop-227 | 11_53_15 (1) | 입을 가리고 보드를 내려다봄 — 예상 밖, 당황 |
| full-house-loses | 11_53_15 (2) | 의자에 기대 허공을 봄 — 허탈감 |
| qq-three-bet-frustration | 11_53_15 (3) | 팔짱 끼고 상대를 노려봄 — 답답함 |
| river-changes-everything | 11_53_15 (4) | 딜러가 마지막 카드를 내려놓는 손 |
| aa-loses | 11_53_15 (5) | 눈을 감고 카드를 밀어 냄 — 좋은 패로 진 실망 |
| ak-flop-miss | 11_53_15 (6) | 턱 괴고 칩을 만지작거림 — 애매한 플랍 후 고민 |

## 총계

| 항목 | 값 |
| --- | --- |
| Source images | **28** (지시서 31 — 위 불일치 참고) |
| Brand/static group | **14** (지시서 17) |
| Category group | 8 |
| Story group | 6 |
| Used source images | **28** |
| Unused source images | **0** |
| Original total size | 44.78 MB (평균 1,638 KB) |
| Production total size | 3.08 MB (평균 113 KB) |
| Average compression | 93.1% 감소 (약 14.6 : 1) |
| Largest production file | `theme-rankings.jpg` — 201 KB |
| Smallest production file | `brand-hands.jpg` — 76 KB |
