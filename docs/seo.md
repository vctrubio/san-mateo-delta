# SEO

How discovery is wired and what to do after a domain change.

## Goal

Rank #1 on Google for *"vacation rental Punta Paloma"*, *"villa 300 m from
Punta Paloma"*, and adjacent long-tail queries. The estate is genuinely 300
metres from Punta Paloma Beach — that phrase is our primary hook and
appears in:

- `<title>` on the homepage and every `/finca/[slug]` page
- The meta description
- The LodgingBusiness `description` + `nearbyAttraction` JSON-LD
- Per-property `keywords` metadata

Body copy on `/` (PropertyShowcase) already mentions it; the SEO work makes
sure crawlers see it everywhere.

## Architecture

| File | Owns |
|---|---|
| `src/lib/site.ts` | Canonical URL resolution (`siteUrl`), `baseMetadata()`, `lodgingBusinessJsonLd()`, OG helpers, `socialProfileUrls()` for `sameAs`. |
| `src/app/layout.tsx` | Calls `baseMetadata()` once at the root — every route inherits via Next's metadata merging. |
| `src/app/page.tsx` | Renders the homepage `LodgingBusiness` JSON-LD script. Computes `priceRange` from `listProperties()` rates. |
| `src/app/finca/[slug]/page.tsx` | Per-property `generateMetadata` + mounts `<PropertyJsonLd>` for House schema. |
| `src/components/finca/PropertyJsonLd.tsx` | Per-property structured data — `House` type, eligible for Google's vacation-rental rich result. |
| `src/app/sitemap.ts` | Dynamic sitemap. Public properties only. |
| `src/app/robots.ts` | Crawler rules + sitemap pointer. |
| `scripts/og-generate.ts` | 1200×630 OG cards in `public/og/`. Re-run after changing source photos. |

## Canonical URL — how it resolves

`siteUrl()` in `src/lib/site.ts` resolves in this order:

1. `NEXT_PUBLIC_APP_URL` — explicit override (recommended in production)
2. `https://${VERCEL_PROJECT_PRODUCTION_URL}` — Vercel's canonical
   production domain (auto-injected, scheme-less)
3. `https://${VERCEL_URL}` — preview deployments (auto-injected, scheme-less)
4. `http://localhost:3000` — dev fallback

If the resolved value lacks `https://` it's prepended automatically. A
malformed URL falls back to localhost with a build-time warning rather
than crashing the deploy.

## After changing the domain

1. **Vercel env**
   ```bash
   vercel env add NEXT_PUBLIC_APP_URL  # https://<new-domain>  (Production + Preview)
   ```
2. Redeploy production. Verify the sitemap, robots, and OG meta tags
   reference the new domain:
   ```bash
   curl -s https://<new-domain>/sitemap.xml | head -20
   curl -s https://<new-domain>/robots.txt
   curl -sI https://<new-domain>/og/finca.jpg   # 200
   ```
3. In Google Search Console, change the property type to the new domain
   (or add a new Domain property and re-verify — see below).

## Google Search Console — first-time setup

This is a runbook for the **owner** (vctrubio@gmail.com) to run after the
domain is pointed at Vercel.

1. **Add the property**
   - Go to https://search.google.com/search-console
   - Add property → **Domain** property → enter `fincasanmateo.com`
     (without scheme or subdomain). The Domain property type covers
     `https://`, `http://`, `www.`, and `m.` variants in one go.
2. **DNS verification**
   - GSC will show a `google-site-verification=<token>` TXT record.
   - Add it at the DNS host (Cloudflare / GoDaddy / whatever owns the
     domain). TTL 300 is plenty.
   - Wait 5–30 minutes for propagation. Click **Verify** in GSC.
3. **Alternative — HTML meta verification (faster, doesn't replace DNS)**
   - GSC also accepts an HTML `<meta>` tag.
   - Copy the `content` value (a long string starting with random chars).
   - Set the Vercel env var:
     ```bash
     vercel env add GOOGLE_SITE_VERIFICATION  # paste the content value
     ```
   - Redeploy. `baseMetadata()` emits the meta tag on every page.
   - Click **Verify** in GSC.
4. **Submit the sitemap**
   - GSC sidebar → **Sitemaps**.
   - Enter `sitemap.xml` → **Submit**.
   - GSC will report the discovered URLs within a few minutes.
5. **Request indexing for the key pages** (bypasses the normal crawl delay)
   - GSC → **URL Inspection** → paste `https://fincasanmateo.com/`
   - **Request Indexing**.
   - Repeat for `/finca` and each `/finca/<slug>` you want indexed fast.
6. **Bing Webmaster Tools** (optional, 30 seconds)
   - https://www.bing.com/webmasters → **Import from Google Search Console**.
   - Picks up the verification + sitemap automatically.

## Verification — is it working?

After deploying:

```bash
# 1. JSON-LD presence
curl -s https://fincasanmateo.com         | grep -oE 'application/ld\+json'
curl -s https://fincasanmateo.com/finca/levante | grep -oE 'application/ld\+json'

# 2. OG cards
curl -sI https://fincasanmateo.com/og/finca.jpg     # 200, image/jpeg, ~110KB
curl -sI https://fincasanmateo.com/og/levante.jpg   # 200

# 3. Sitemap + robots
curl -s https://fincasanmateo.com/sitemap.xml
curl -s https://fincasanmateo.com/robots.txt
```

External validators (paste a deployed URL):

- **schema.org**: https://validator.schema.org/ — expect zero errors
- **Rich Results Test**: https://search.google.com/test/rich-results —
  homepage should report `LodgingBusiness` is eligible; property pages
  should report `House` (vacation rental) eligibility
- **OpenGraph preview**: https://www.opengraph.xyz/
- **Twitter card validator**: https://cards-dev.twitter.com/validator
- **LinkedIn Post Inspector**: https://www.linkedin.com/post-inspector/

## Realistic ranking timeline

- **Day 1–3**: GSC discovers and crawls the submitted URLs.
- **Week 1–2**: `site:fincasanmateo.com` shows indexed pages. The estate
  becomes findable by exact name.
- **Week 2–6**: Long-tail Punta Paloma queries surface the site on page 1
  if no other competitor is gunning for the same phrase (currently true
  — Punta Paloma is a beach, not a vacation-rental category, so the
  competition is mostly travel blogs and Airbnb listings).
- **Month 2+**: Generic queries ("Tarifa vacation rental", "villa
  Tarifa") are harder — Airbnb / Booking / Vrbo dominate. We won't beat
  them on those without paid spend or a major content push. Stay
  focused on the geographic micro-niche.

## Re-running OG card generation

If you swap a property photo or the FincaBanner:

```bash
bun og:generate
git add public/og/
git commit -m "regen OG cards"
```

The script reads from `public/finca/banners/FincaBanner.jpg` and
`public/images/{slug}.{png,jpg,jpeg}` (first match wins). Outputs are
always `.jpg` at 1200×630, ~80–150 KB each.
