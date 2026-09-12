# WP-S3-16 — SEO / IA integration

## Objective
Exhaustive SEO/IA pass over the content-complete 3BetTilt site, verified in the built HTML: metadata, canonical/hreflang, JSON-LD, sitemap/robots, internal link graph (orphans), cannibalization, image metadata; plus the carried-over items (orphan inbound links, `<Term>` for 브로드웨이/커넥터, `definedTermJsonLd` move, `관련 가이드` label, preview-indexing check).

## Facts verified before work
- Clean build existed (`.next` BUILD_ID present, 144 HTML, sitemap 141 URLs). Baseline audit (`.data/tools/seo-audit.mjs`): 0 broken links, 0 duplicate titles/descriptions, 3 orphans (`glossary/c-bet`·`bluff`·`ip-oop`, 1 inbound each; `nuts` already 2 via WP-07 i3's `<Term>` in `blog/playing-the-board`).
- `definedTermJsonLd` (WP-11, `src/components/glossary/`) emitted a TOP-LEVEL `DefinedTerm` block with no `@context` on all 64 glossary pages; `tests/e2e/seo.spec.ts` `ALLOWED_TYPES` did not include `DefinedTerm` (both would have failed the "every JSON-LD block … @context" e2e).
- `tests/e2e/seo.spec.ts` "every CollectionPage row is a link … in that order" was failing on `/ko/learn` before this WP: the hub renders each lesson twice (roadmap + category browse); the `ItemList` lists 15. Pre-existing (noted in WP-14 handoff), not caused by content work.
- No env-gated robots/noindex logic exists (`robots.ts`, `metadata.ts`, `policy.ts`); `NEXT_PUBLIC_SITE_URL` changes origin only. Deploy doc §2/§5 matches the code.
- `RELATED_LABELS` (D-S3-16) had 6 labels; `HandOnward.GUIDES_LABEL = '관련 가이드'` was outside it.
- `content.test.ts` requires every `<Term id>` in prose to be in that record's `relatedConcepts`, and at most one `<Term>` per term per article. `faq.ts` drops a Q&A pair that contains a component — so no `<Term>` was placed inside a `## 자주 묻는 것` section.
- Stories' own `relatedTools`: s1/s2/s3 declare `toolEquity`/`toolHandChecker`/`toolPotOdds`/`toolOuts` — used as the gate for tool→story links.

## Decisions made
1. Orphans fixed with genuine contextual `<Term>` links + matching `relatedConcepts` (never link spam): `c-bet` ← `learn/flop-turn-river` (postflop paragraph, wording = the term's `shortDefinition`); `bluff` ← `learn/poker-actions` (bet section); `ip-oop` ← `learn/position` (인포지션/아웃오브포지션 section, first mention).
2. 브로드웨이/커넥터 `<Term>` added to `hands/kjs·jts·qjs·t9s` and `learn/starting-hands` (+`relatedConcepts` in `k4.ts`/`h1.ts`). `t9s` and `kjs` got a one-word prose change ("커넥터") to carry the link. `kqs` untouched (not in the request).
3. `관련 가이드` added to `RELATED_LABELS` (7 labels). `HandOnward` itself untouched; `RelatedContent.test.tsx` now pins the 7-label set and asserts `HandOnward`'s `GUIDES_LABEL`/`STORIES_LABEL` are members.
4. Tool → hand stories under the existing `이런 이야기도 있어요` group (`TOOL_GUIDE_LINK_IDS.articles`), only where the story's own `relatedTools` names the tool: equity +3 (`qq-vs-72o-flop-227`, `aa-loses`, `ak-flop-miss`), pot-odds +2 (`river-changes-everything`, `qq-three-bet-frustration`), outs +1 (`river-changes-everything`), hand-checker +2 (`full-house-loses`, `qq-vs-72o-flop-227`). range/starting-hand: no story declares them → none added. `guideLinks.test.ts` enforces the mirror.
5. `definedTermJsonLd` moved into `src/lib/seo/jsonLd.ts` beside `definedTermSetJsonLd`, now with `@context`; exported from the barrel; the WP-11 files under `src/components/glossary/` deleted (tests moved to `jsonLd.test.ts`). `DefinedTerm` added to seo.spec `ALLOWED_TYPES`.
6. seo.spec CollectionPage-order test: compare the FIRST occurrence of each declared row (same rule `hubCollectionPage.test.tsx` already pins per orchestrator instruction). JSON-LD unchanged (listing 30 rows would duplicate URLs).
7. Preview-environment indexing: verified, NOT changed (deployment concern; a code gate belongs in `next.config.ts#headers()` as `X-Robots-Tag: noindex` under `VERCEL_ENV === 'preview'` — outside boundary, and the deploy doc reserves it for the orchestrator). See audit §7.
8. Meta descriptions NOT lengthened (53 glossary pages < 50 chars, min 21): all unique, complete sentences, and visible copy in `RelatedContent` cards → owner decision. List in audit §8.
9. Cannibalization: no shared titles; near-synonym pairs (learn↔glossary for 3벳 / 13×13 / 팟오즈) are cross-linked both ways; retitles are `title` = H1 fields outside this WP. Maps updated with final state (keyword map §8/§9, cannibalization map §6).

## Files changed
- MDX (by hand, no prettier): `content/learn/{flop-turn-river,poker-actions,position,starting-hands}.mdx`, `content/hands/{kjs,jts,qjs,t9s}.mdx`.
- Registry relations: `src/content/registry/learn/{h1,h2,h3}.ts`, `src/content/registry/hands/k4.ts`.
- `src/features/tools/guideLinks.ts` (+ `guideLinks.test.ts`).
- `src/components/RelatedContent.tsx` (+ `RelatedContent.test.tsx`).
- `src/lib/seo/jsonLd.ts`, `src/lib/seo/index.ts`, `src/lib/seo/jsonLd.test.ts`; `src/app/[locale]/glossary/[slug]/page.tsx` (import only).
- Deleted: `src/components/glossary/definedTermJsonLd.ts`, `src/components/glossary/definedTermJsonLd.test.ts`.
- `tests/e2e/seo.spec.ts` (+8 tests, `DefinedTerm` allowed, first-occurrence dedupe), `tests/e2e/locale.spec.ts` (+1).
- New tool: `apps/fishtilt/.data/tools/seo-audit.mjs` (gitignored).
- Docs: `docs/reports/stage3/WP_S3_16_SEO_AUDIT.md` (new), `3BETTILT_KEYWORD_MAP.md` (§8, §9 appended), `3BETTILT_CANNIBALIZATION_MAP.md` (§6 appended), this handoff.

## Tests run
- `pnpm vitest run --project fishtilt --project learn-core` → **234 files, 2609 passed, 0 failed** (was 2606: +4 jsonLd, +1 guideLinks, +1 RelatedContent, −3 deleted).
- `pnpm --filter @gto-self/fishtilt typecheck` → exit 0. `pnpm exec eslint apps/fishtilt/src apps/fishtilt/tests` → exit 0.
- e2e under the build lock (one clean build, `rm -rf .next && …`): `seo, locale, glossary, hands, learn, equity, pot-odds, outs, hand-checker` → 127 passed / 1 failed (the pre-existing `/ko/learn` order case); after the first-occurrence fix, `seo + locale + glossary + hands` re-run against the same build → **73 passed, 0 failed**. seo.spec now 30 tests.
- Not run: full e2e suite, `pnpm build` from the root, screenshots (no visual change).

## Build/runtime evidence
- Build log: no `ƒ` routes; sitemap `[fishtilt] NEXT_PUBLIC_SITE_URL is not set — using production origin default https://3bettilt.com`.
- Audit after (audit §1–§3): 141 sitemap URLs = 141 indexable documents; canonical/og/hreflang/twitter/lang/single-title/single-h1 = 141/141; JSON-LD parse errors 0; broken links 0; orphans 0 (root exempt); inbound min 2 (10 glossary pages), median glossary 6 / learn 14 / blog 9 / hands 7; hub→child 100 %; brand scan (`FishTilt|FISHTILT|fishtilt.example|example.com|localhost`) 0.
- `NoFallbackError` lines in the e2e server log are Next's normal 404 logging for `/learn`, `/xx/learn`, `/ko/learn/no-such-lesson` requests.

## Known limitations
- `.data/tools/seo-audit.mjs` counts `role="presentation"` SVGs as labelled; one home SVG (`HomeHeroVisual.tsx:76`) has neither `aria-hidden` nor `role`.
- The e2e orphan rule counts links in `<main>` minus the breadcrumb `<nav>`; a future template that renders its cross-links outside `<main>` would look orphaned to it.
- `hreflangAlternates` still emits only the page's own locale + `x-default`; a second locale needs translated records before its tag is truthful (D-S3-06) — unchanged.

## Open issues
1. (owner, titles) learn `holdem-basics`·`poker-hand-rankings`·`starting-hands`·`positions-6max` and glossary `<쉬운 설명> (<원어>)` titles do not carry the Korean head query (keyword map §8/§9). learn/glossary types have no `seoTitle`; adding one is a `types.ts` decision.
2. (owner, `routes.ts`) nav label `핸드레인지` → `/tools/range` vs learn `핸드레인지란?`; `팟 오즈`(tool label) vs `팟오즈`.
3. (orchestrator, deploy) preview noindex gate — audit §7 proposal (`next.config.ts#headers()`); verify Vercel's `X-Robots-Tag` on the first preview per deploy doc §5.2.
4. (`src/app/global-error.tsx`) 500 page: no `<html lang>`, English title, no robots meta.
5. (`src/components/HomeHeroVisual.tsx:76`) decorative SVG without `aria-hidden="true"`.
6. (glossary owners) 15 descriptions < 30 chars (audit §8) — optional lengthening.
7. Missing intent owners unchanged: `체크레이즈 뜻`, `포켓페어 확률`, `플러시/스트레이트 확률` (new content, not SEO).
8. 10 glossary pages sit at exactly 2 contextual inbound links (category hub + one neighbour), incl. new `gutshot`·`open-ended`·`set-vs-trips` — candidates for a lesson `<Term>` in the next content round.

## Exact facts next agent may rely on
- `RELATED_LABELS` = 더 배우기 / 직접 확인하기 / 같이 알아둘 용어 / 이런 이야기도 있어요 / 비슷한 핸드 / 다음으로 읽기 / 관련 가이드 (closed union, pinned by `RelatedContent.test.tsx`).
- `definedTermJsonLd` lives in `src/lib/seo/jsonLd.ts` (barrel export), emits `@context` + `@type: DefinedTerm`; seo.spec `ALLOWED_TYPES` includes `DefinedTerm`; every glossary page emits exactly one, no other page any.
- Sitemap = 141 URLs (`/ko` + 16 static + 125 content); `/ko/search` noindex,follow, no hreflang, canonical self.
- seo.spec asserts, over every sitemap page: single `<title>`, single `<h1>`, `<html lang="ko">`, og:type/locale/site_name/image:width/height/description, twitter:card, unique descriptions, ≥2 contextual inbound (root exempt), no `FishTilt`/`FISHTILT`/placeholder hosts; 404s are noindex with no canonical/hreflang.
- Tool→story listing rule: a story appears on a tool only if the story's `relatedTools` includes that route id (`guideLinks.test.ts`).

## Facts next agent MUST re-check
- Any new `<Term>` in a `## 자주 묻는 것` section silently drops that FAQ pair from `FAQPage` (`faq.ts`) — check FAQPage counts after editing hands/learn FAQ prose.
- If a hub ever renders its children in a different first-occurrence order than its `ItemList`, seo.spec fails (by design).
- `.next` currently holds this WP's clean build; the orchestrator's final regression should rebuild.
