# 3BetTilt Image SEO — 01 Asset mapping

Date: 2026-09-15 · Scope: `apps/fishtilt/public/visuals/` (28 production editorial JPEGs)

Files were renamed with a plain filesystem `mv`. The bytes are identical before and after
(SHA-1 set compared), so nothing was re-encoded. Crop, resize, quality and dimensions are
unchanged. `scripts/editorial-images.manifest.json` `file` fields were updated to match. The
processing script was not run.

Names were picked after looking at each photo. They describe what is in the frame (plus the
story moment for the six hand stories). They contain no brand name, no `image-/brand-/theme-/story-/home-`
prefix, and nothing about gender, nationality or appearance.

## Role rule

- **informational**: the picture shows what its page is about. On the page's own unlinked
  featured slot it renders with a descriptive `alt` (`EditorialVisual describe`).
- **decorative**: atmosphere beside a heading or behind a sentence that already says it all.
  Its `alt` is always `""`.
- Wherever an image sits inside a card link, thumbnail or backdrop, it renders `alt=""` no
  matter what its role is, so it never repeats the link text.

## Category themes (8, informational)

| old | new | role | alt | used on |
| --- | --- | --- | --- | --- |
| theme-basics.jpg | empty-poker-table-under-pendant-light.jpg | informational | 어두운 방, 펜던트 조명 아래 게임을 기다리는 빈 포커 테이블 | Lessons/guides/glossary in the basics theme (featured, described) · learn hub category · cards · OG card background |
| theme-rankings.jpg | card-decks-and-poker-chips.jpg | informational | 뒷면이 보이는 카드 덱과 포커 칩을 가까이서 담은 장면 | Hand-rankings lessons/terms/guides · cards · OG |
| theme-starting-hands.jpg | two-face-down-hole-cards.jpg | informational | 플레이어의 손 옆에 뒷면으로 놓인 두 장의 홀카드 | Starting-hand lessons/guides (described) · `/hands/*` backdrop (decorative) · OG |
| theme-range.jpg | poker-study-notebook-and-cards.jpg | informational | 노트와 연필, 카드 한 벌이 놓인 붉은 조명의 포커 공부 책상 | Range lessons/guides · cards · OG |
| theme-position.jpg | six-seat-poker-table-top-view.jpg | informational | 위에서 내려다본 6인용 포커 테이블의 좌석과 딜러 버튼 | `/learn/position` and the position theme (described) · cards · OG |
| theme-betting.jpg | hand-pushing-poker-chips.jpg | informational | 칩 한 묶음을 앞으로 미는 손과 흐릿한 배경의 테이블 | Betting lessons/terms/guides · cards · OG |
| theme-math.jpg | player-thinking-by-probability-charts.jpg | informational | 확률 그래프가 흐릿하게 비치는 벽 앞에서 생각에 잠긴 플레이어 | Odds/equity lessons/guides · cards · OG |
| theme-story.jpg | late-night-poker-hand-in-progress.jpg | informational | 늦은 밤 포커 룸, 한 판에 집중한 두 플레이어 | Fallback for hand stories without their own picture (described) · OG |

## Hand stories (6, informational)

| old | new | role | alt | used on |
| --- | --- | --- | --- | --- |
| story-qq-vs-72o-flop-227.jpg | player-stunned-by-qq-vs-72o-flop.jpg | informational | 2-2-7 플랍을 보고 입을 가린 채 테이블을 내려다보는 플레이어 | `/ko/blog/qq-vs-72o-flop-227` hero (described) · home stories · blog hub featured card · OG |
| story-full-house-loses.jpg | player-leaning-back-after-full-house-loss.jpg | informational | 풀하우스로 지고 의자에 등을 기댄 채 허공을 올려다보는 플레이어 | `/ko/blog/full-house-loses` hero · cards · OG |
| story-qq-three-bet-frustration.jpg | player-frustrated-after-qq-three-bet.jpg | informational | QQ로 3벳한 뒤 팔짱을 끼고 맞은편 상대를 노려보는 플레이어 | `/ko/blog/qq-three-bet-frustration` hero · cards · OG |
| story-river-changes-everything.jpg | dealer-placing-river-card.jpg | informational | 딜러가 보드에 마지막 리버 카드를 내려놓는 순간 | `/ko/blog/river-changes-everything` hero · cards · OG |
| story-aa-loses.jpg | player-losing-stack-with-pocket-aces.jpg | informational | 포켓 에이스로 스택을 잃고 눈을 감은 채 카드를 밀어 내는 플레이어 | `/ko/blog/aa-loses` hero · cards · OG |
| story-ak-flop-miss.jpg | player-thinking-after-ak-misses-flop.jpg | informational | AK로 플랍을 놓치고 턱을 괸 채 칩을 만지작거리며 고민하는 플레이어 | `/ko/blog/ak-flop-miss` hero · cards · OG |

## Brand / page slots (14, decorative, `alt=""`)

The registry `description` column records what is in the frame for maintainers. It is never rendered.

| old | new | role | description (not rendered) | used on |
| --- | --- | --- | --- | --- |
| home-hero.jpg | smiling-player-in-poker-lounge.jpg | decorative | 포커 룸의 가죽 의자에 턱을 괴고 앉아 미소 짓는 플레이어 | `/ko` hero (`HomeHeroVisual`) |
| home-breathing.jpg | poker-lounge-table-wide-view.jpg | decorative | 어두운 포커 룸의 넓은 전경, 조명 아래 칩이 놓인 테이블 | `/ko` breathing band |
| home-stage-rules.jpg | face-down-cards-fanned-on-felt.jpg | decorative | 펠트 위에 뒷면으로 펼쳐 놓은 카드와 칩 | `/ko` roadmap stage 1 |
| home-stage-range-position.jpg | round-poker-table-top-view.jpg | decorative | 위에서 내려다본 원형 포커 테이블과 둘러앉을 자리 | `/ko` roadmap stage 2 |
| home-stage-postflop-math.jpg | notebook-pen-and-cards-on-poker-table.jpg | decorative | 테이블 위에 놓인 노트와 펜, 카드 한 벌 | `/ko` roadmap stage 3 |
| brand-feature.jpg | hand-stacking-poker-chips.jpg | decorative | 테이블 위에서 칩을 쌓는 손 | `/ko` closing CTA band |
| brand-blog.jpg | player-on-red-velvet-sofa.jpg | decorative | 붉은 벨벳 소파 앞에서 턱을 괴고 앉은 플레이어 | `/ko/blog` hero |
| brand-learn.jpg | hand-resting-on-face-down-cards.jpg | decorative | 뒷면으로 놓인 두 장의 카드에 손을 올린 플레이어 | `/ko/learn` hero |
| brand-hands.jpg | player-resting-chin-at-poker-table.jpg | decorative | 칩을 앞에 두고 테이블에 턱을 괴고 앉은 플레이어 | `/ko/hands` hero |
| brand-practice.jpg | player-holding-up-two-cards.jpg | decorative | 뒷면이 보이는 카드 두 장을 들어 보이는 플레이어 | `/ko/practice` hero |
| brand-glossary.jpg | player-thinking-at-poker-table.jpg | decorative | 테이블에 앉아 생각에 잠긴 플레이어 | `/ko/glossary` hero |
| brand-tools.jpg | player-in-red-lit-poker-room.jpg | decorative | 붉은 조명 아래 테이블 앞에 선 플레이어 | `/ko/tools` hero (desktop) |
| brand-about.jpg | player-beside-spade-emblem-wall.jpg | decorative | 스페이드 문양이 걸린 벽 앞에서 턱을 괴고 미소 짓는 플레이어 | `/ko/about` hero |
| brand-about-table.jpg | two-players-facing-off-late-night.jpg | decorative | 늦은 밤 테이블에서 마주 앉아 수를 고민하는 두 플레이어 | `/ko/about` mid-page band |

## System assets (not editorial, not renamed)

- `public/og.png`: the shared social card. Its name is unchanged, but its `og:image:alt` was
  changed from `3BetTilt` to `3BetTilt 워드마크와 붉은 칸이 채워진 13×13 핸드 격자`.
- `src/app/icon.svg` and `src/app/apple-icon.png`: favicon and app icon. Left as they were.
- `/og/{kind}/{slug}.png`: per-page social cards generated at build time. The URL scheme is
  unchanged.
