# 3BetTilt URL migration: production deployment (2026-09-17)

- Commit `e52a129` "feat: migrate Korean URLs to prefixless routes": 92 files. Root `prompt` was not staged; no other projects' files were staged. No `.env` files, secrets or API keys were staged.
- Pushed with `git push origin main`: PASS (`a580339..e52a129`).
- Vercel Git integration: Production deployment `6499432564` for `e52a129`, status success. No new Vercel project was created, and DNS/Cloudflare were not changed.
- Docs: the E2E status in reports 03 and SUMMARY now matches the final state. The initial run was 342 PASS + 2 stale FAIL; both were fixed, and `seo.spec.ts` passed 31/31, leaving 0 known failures. One leftover `/ko` example in `DEPLOY_3BETTILT.md` §5.2 was corrected.

## Production smoke (curl, no full test suite)

| Check | Result |
| --- | --- |
| `/` | 200, no redirect |
| `/learn`, `/tools/equity`, `/blog/aks-vs-ako`, `/glossary/three-bet`, `/hands/aa` | 200 each |
| `/ko` | 308 → `/` → 200 (1 hop) |
| `/ko/learn/pot-odds`, `/ko/tools/equity`, `/ko/hands/aa` | 308 → prefixless → 200 (1 hop each) |
| `/ko/does-not-exist` | 404 (no redirect) |
| `/sitemap.xml` | 200, 141 `<loc>`, 0 `/ko` |
| `/robots.txt` | 200 |
| Home | canonical and og:url `https://3bettilt.com`; title unchanged; `index, follow`; no noindex; no `x-robots-tag`; hreflang is `ko-KR` + `x-default` only |
| `/learn/pot-odds`, `/tools/equity`, `/hands/aa`, `/blog/aks-vs-ako` | prefixless canonical; hreflang `ko-KR` + `x-default` prefixless; 0 `/ko` URLs in JSON-LD or anywhere in the HTML |
