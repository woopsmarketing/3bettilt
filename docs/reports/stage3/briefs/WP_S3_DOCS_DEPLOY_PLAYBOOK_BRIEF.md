# WP-S3-DOCS — DEPLOY_3BETTILT.md + 3BETTILT_OPERATING_PLAYBOOK.md — brief

FIRST read `docs/reports/stage3/AGENT_COMMON_RULES.md` (mandatory), then the ORCHESTRATOR DECISIONS table in
`docs/3BETTILT_STAGE3_STATE.md`, `handoff/WP_S3_01A_HANDOFF.md` + `WP_S3_01B_HANDOFF.md` (brand/origin/locale),
`3BETTILT_KEYWORD_MAP.md`, `3BETTILT_CANNIBALIZATION_MAP.md`, and master prompt `prompt` §DG, §DH, §DI, §DJ, §DN
(lines 3333–3470 and 3735–3766).

This is a **docs-only** WP. You write two files. You change NO code, config or content. Every technical statement
must be verified against the actual source (open the file; cite `path:line` in an appendix "근거"). Other agents
are editing code concurrently — read only.

## 1. `docs/DEPLOY_3BETTILT.md` (Korean, owner-facing, step-by-step)
Must cover (§DG): production domain `https://3bettilt.com`; `NEXT_PUBLIC_SITE_URL=https://3bettilt.com` (no `/ko`,
no trailing slash — verify how `src/lib/seo/**`/site config reads and validates it, and what happens when unset in a
production build); `/ko` architecture (root `/` → `/ko` redirect: how it is implemented in a static build — verify
next.config / `src/app/page.tsx`; locale list; how a future locale is added); Vercel project configuration for a
pnpm monorepo (Root Directory = `apps/fishtilt` vs repo root — check `apps/fishtilt/package.json`, root
`package.json` scripts `build:fishtilt`, `pnpm-workspace.yaml`, workspace deps like `@gto-self/learn-core`/
`strategy-core` that must be built/transpiled; Install/Build/Output settings; Node version from `engines`/`.nvmrc` if
any — if none, say so and recommend one without inventing a requirement); root/build assumptions; clean `.next`;
environment variables (list every `process.env.*` the app reads — grep); Preview deployment (and why preview must
not be indexed: check whether robots/metadata depend on env — if preview would be indexable, say so plainly as an
owner risk and propose the fix as an open item, do not change code); Production deployment; custom domain; www
policy (`www.3bettilt.com` → 301 → apex, done in Vercel domain settings); **Cloudflare DNS**: say explicitly that the
exact record values (A/CNAME targets) come from the Vercel dashboard's domain screen — NO fake IPs or CNAME targets;
proxy status (DNS-only vs proxied) trade-offs with Vercel, SSL/TLS mode (Full (strict) if proxied); HTTPS; sitemap
URL + robots.txt URL and what they should contain (verify from the generated files in `.next`/build output if a
build exists, else from source); Google Search Console (Domain property via DNS TXT, sitemap submission, URL
inspection of representative URLs); **production smoke test** checklist with exact URLs (`/`, `/ko`, one per
section, `/ko/search` noindex, a 404, `/sitemap.xml`, `/robots.txt`, canonical/og:url on 3 pages, JSON-LD parse,
dark/light, mobile). §DH domain policy incl. the `3bettilt.co.kr` → 301 note (document only, not owned).
§DN Owner review gate: preview-first procedure; if you (the agent) have no Vercel access, give exact instructions.
Do not claim anything was deployed.

## 2. `docs/3BETTILT_OPERATING_PLAYBOOK.md` (Korean, owner/editor-facing)
The §DJ loop as a concrete weekly/monthly routine: Search Console → query discovery → existing page? YES: update /
expand / retitle / link (how to decide; where each page type lives in the repo: registry batch files + MDX;
`readMinutes` measured; FAQ `### 질문?` convention; `<Fact>` for every number) → NO: content candidate →
cannibalization check (against `3BETTILT_CANNIBALIZATION_MAP.md` + keyword map; rules for which page owns which
intent: Learn vs Blog search-guide vs Glossary vs Hands vs Tools) → publish (how: add registry record + MDX + tests,
run gates) → internal links (relation fields, RelatedContent labels) → index (sitemap is automatic? verify) →
observe (CTR, ranking, CWV). Include: content-type recipes (search guide, hand story incl. mandatory disclosure
"학습과 재미를 위해 재구성한 핸드 시나리오입니다." and evaluator validation, glossary term, hand page), editorial rules
(no invented poker numbers; ranges only "6-Max · 100BB · First In" learning baseline, never "GTO", never range
source names, no "cross-checked" claims; no prescriptive live-play advice; no affiliate/deposit CTAs; no live-play
assistance/OCR), a pre-publish checklist, an error-correction procedure, and a metrics table (what to watch, where,
what action). Keep it practical; no marketing fluff; no fabricated traffic numbers or targets.

## File boundary
- `docs/DEPLOY_3BETTILT.md`, `docs/3BETTILT_OPERATING_PLAYBOOK.md`, `docs/reports/stage3/handoff/WP_S3_DOCS_HANDOFF.md`.
Nothing else. If you find a real deployment risk in code (e.g. preview indexable, env unset → wrong origin), list
it in the handoff under "Open issues for WP-16/19" with `path:line` — do not fix it.

## Done when
Both docs written, every technical claim cited in an appendix, no fake DNS values, no deploy claims. Handoff.
Final reply ≤ 25 lines. Stop.
