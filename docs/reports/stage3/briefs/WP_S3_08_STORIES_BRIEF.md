# WP-S3-08 HAND STORIES — brief (shared by story agents S1, S2, S3)

You write **two** new 3BetTilt hand stories — the site's core editorial pillar. Your batch letter
(S1/S2/S3) and your two stories are given in your task message.

## Read first
1. `docs/reports/stage3/AGENT_COMMON_RULES.md` (mandatory; build-lock in the FOREGROUND, timeout 600000).
2. `docs/reports/stage3/handoff/WP_S3_06_HANDOFF.md` — section "WP-08 (스토리 4–6편) — 스토리 1편 추가 절차":
   the exact files and record shape. The full worked example is
   `apps/fishtilt/src/content/stories/testing/fixtureStory.ts` (`FIXTURE_STORY`, `FIXTURE_STORY_MDX`).
   Read `apps/fishtilt/src/content/stories/{types,resolve,validate}.ts` to know what the validator enforces
   (heads-up showdown only, blinds 0.5/1, 6-max, no side pots/rake/antes, integer milliBB via `bb()`).
3. Master-prompt rules for stories (summarised here, binding):
   - Fictional/reconstructed first-person scenario is allowed ("내 핸드는 QQ였다.", "BTN에서 3벳했다.",
     "상대 패를 봤을 때 정말 어이가 없었다."). The visible disclosure
     "학습과 재미를 위해 재구성한 핸드 시나리오입니다." comes from `HAND_STORY_DISCLOSURE` — never hide it,
     never claim it is a real played hand, no real player names/sites/tournaments.
   - The event in the title MUST happen in the story (cards, board, action). H1 (`title`) is emotional/curious;
     `seoTitle` states the search intent, e.g. "홀덤 핸드 리뷰: QQ vs 72o, 플랍 227에서 벌어진 상황 | 3BetTilt" —
     both must describe what actually happens. Check how `seoTitleOf` appends the brand before adding "| 3BetTilt"
     yourself (don't double it).
   - Template sections the MDX provides: lead → PRE-FLOP → FLOP → TURN → RIVER → SHOWDOWN (verified) →
     흥미로운 지점 → 무엇을 배울 수 있나 (learning context, NOT real-time "you should do X at the table" advice).
   - Numbers: any equity/probability/combo figure must come from learn-core/strategy-core via `<Fact>` (see how
     other blog MDX uses `Fact`), never typed. The showdown winner and hand names are computed by the validator
     against the evaluator — your record must agree with it. Pot sizes are computed from the actions.
   - Ranges: never "GTO". If you mention whether a hand is in the 6-max 100BB First-In learning range, use the
     real data; facing-3-bet/call ranges are NOT supported by the site — don't imply a "correct" calling range.
   - Voice: vivid, human, a little dramatic and funny, short paragraphs, natural Korean (반말 1인칭 narrative is
     fine for stories; keep it readable and not crude). ~This is the part readers remember — make it good.
     Avoid gambling glamour (no deposits, no "big win money" framing); stakes as "온라인 6인 캐시 게임" style
     neutral text as in the fixture.
4. Links: set `relatedConcepts` (existing glossary ids), `relatedTools` (route ids in `src/lib/routes.ts`),
   `relatedHands` (existing hand page ids), `nextLessons`, `relatedArticles` (existing blog ids + the other
   stories in your batch). Contextual in-body links via existing conventions where natural (e.g. first mention of
   3벳 → glossary, "승률" → equity tool).
5. `readMinutes` is measured; `indexable: true` needs enough prose to pass `threshold.ts` — write a full story,
   not a stub.

## Your file boundary
- `apps/fishtilt/src/content/registry/blog/stories/<sN>.ts` (your batch file only) + a test file next to it if useful
- `apps/fishtilt/src/content/blog/<sN>.ts` (your MDX import map only)
- `apps/fishtilt/content/blog/<your two slugs>.mdx`
- `docs/reports/stage3/handoff/WP_S3_08_<SN>_HANDOFF.md`
Nothing else. Other agents are concurrently editing the homepage, tools, and learn content; failures in files you
don't own are theirs — report, don't fix. If the story template/validator has a bug, report it with a failing case
rather than editing `src/content/stories/**` or `src/components/blog/**`.

## Done when
- `pnpm vitest run --project fishtilt src/content/registry/blog/stories src/content` — all failures naming your ids
  fixed (list any others).
- First-story build check (WP-06 asked for it): build + next start + shoot.mjs of both your story pages at
  1440x900 and 390x844, dark + light, `--fold`, into `artifacts/3bettilt-stage3-visual-qa/wp08-<sN>/`. LOOK at them:
  the StreetSection boards/timelines must actually render from the record (not empty), disclosure visible near the
  top, showdown result shown, no overflow. Also confirm the story appears on `/ko/blog` (shoot it once).
- Handoff: per story — title/seoTitle, the hand (positions, cards, board, action summary), computed showdown,
  every number and its source, links set, what a reader learns.
Final reply ≤ 25 lines. Stop when your two stories are done.
