# 3BetTilt URL Migration 02: Legacy `/ko` redirects

## Rule

`src/lib/legacyLocaleRedirects.ts` → `LEGACY_PREFIXED_SITE_PATHS` holds **142** paths. That is every page the
pre-migration build prerendered under `/ko`, taken from its `prerender-manifest.json`: 141 indexable
pages plus `/search`. `next.config.ts` turns each one into
`{ source: '/ko<path>', destination: '<path>', permanent: true }` (root: `/ko` → `/`).

- **Exact 1:1, one hop, 308.** No old URL goes to the homepage unless it *was* the homepage.
- **No pattern rule.** `/ko/does-not-exist` and `/ko/learn/does-not-exist` get no redirect; they return a normal 404 (no soft 404).
- **Frozen on purpose.** The list records URLs that existed. Pages added later never had a `/ko` address.
  `legacyLocaleRedirects.test.ts` fails if a listed destination stops being a live page.
- **No loops.** No destination is a source; `routes-manifest.json` has `rewrites: []`, `headers: []`.
- The prefix comes from `DEFAULT_LOCALE`, so no `/ko` literal appears in shipped source (the `locale.test.ts` guard still passes).

`routes-manifest.json` after build: 143 redirects = Next's internal trailing-slash rule + 142 migration rules.

## Representative before → after

| Old URL (308) | New URL (200) |
| --- | --- |
| `/ko` | `/` |
| `/ko/learn` | `/learn` |
| `/ko/learn/pot-odds` | `/learn/pot-odds` |
| `/ko/tools` | `/tools` |
| `/ko/tools/equity` | `/tools/equity` |
| `/ko/blog/aks-vs-ako` | `/blog/aks-vs-ako` |
| `/ko/glossary/three-bet` | `/glossary/three-bet` |
| `/ko/hands/aa` | `/hands/aa` |
| `/ko/practice/hand-ranking-quiz` | `/practice/hand-ranking-quiz` |
| `/ko/about` | `/about` |
| `/ko/search` | `/search` (noindex) |

## Measured chains (local `next start`, production build)

| Request | Result |
| --- | --- |
| `/` | 0 hops, 200 |
| the 10 old URLs above | **1 hop** → exact new URL → 200 |
| all 142 legacy URLs (scripted) | **142/142**: 308, `location` = expected path, destination 200 |
| `/ko/` | 2 hops (Next trailing-slash 308 → `/ko` → `/`) → 200 |
| `/ko/learn/pot-odds/` | 2 hops → `/learn/pot-odds` 200 |
| `/ko/does-not-exist`, `/ko/learn/does-not-exist` | 404, no redirect |
| `/does-not-exist`, `/en`, `/en/learn` | 404 |
| `/sitemap.xml`, `/robots.txt`, `/og/learn/pot-odds.png` | 200 |

## Infrastructure chain (live site today, read-only curl; outside code scope, not changed)

| Request (live now, before deploy) | Now | Expected after deploy |
| --- | --- | --- |
| `https://3bettilt.com/` | 1 hop → `/ko` | 0 hops, 200 |
| `http://3bettilt.com/` | 2 hops | 1 hop (http→https) → 200 |
| `https://www.3bettilt.com/` | 2 hops | 1 hop (www→apex, Vercel) → 200 |
| `http://www.3bettilt.com/` | 3 hops | 2 hops (Cloudflare http→https, then www→apex) → 200 |
| `https://www.3bettilt.com/ko/learn` | 1 hop → apex `/ko/learn` | 2 hops (www→apex, then `/ko/learn`→`/learn`) |

The last two rows are infrastructure hops (Cloudflare `http→https` on www, Vercel `www→apex`). You
could remove one with a Cloudflare redirect rule `http://www.* → https://3bettilt.com/*`. That's optional
and I didn't change it.
