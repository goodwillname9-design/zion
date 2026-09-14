# ZION V70

Adds public /about and /safety pages, updates /privacy, adds homepage links, unique page titles/descriptions, canonical URLs, robots.txt and sitemap.xml. Uses the existing ZION theme with responsive text and navigation. Canonical production origin is https://zion-one-nu.vercel.app; change it if you move domains.

Upload: retains the duplicate-header correction, rejects failed token refresh rather than silently reusing stale tokens, and supplies versioned error codes without exposing raw request details. This is not confirmation that the unresolved live upload issue is fixed. Test photo/video/voice and view-once with two real accounts after deployment. Previous V68 setup remains required. No new SQL or environment variables are introduced.

Privacy text describes implemented controls and limitations. Before treating it as a complete operator privacy policy, supply the operator identity, a working privacy/deletion contact, and verified retention practices. These details were not invented. Public pages make no guarantee of absolute anonymity, screen-capture prevention or audited call E2EE.

## Deploy from VS Code

```sh
npm ci
npm run build
git add app lib/resumable-upload.ts public/sw.js tests/v69-upload.cjs V70_SETUP.md
git commit -m "ZION V70 public pages SEO and upload diagnostics"
git push
```

After deployment, open /about, /safety, /privacy, /robots.txt and /sitemap.xml. Submit sitemap.xml in Google Search Console. Indexing, rankings and AI recommendations are not guaranteed. No deployment or physical-device test was performed here.
