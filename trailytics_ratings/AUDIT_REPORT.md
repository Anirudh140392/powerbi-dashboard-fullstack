# Ratings Correctness Audit

_Audit lead report. Backend = `server/api.cjs` (Express + pg) and `scan_competitor_mentions.cjs`; frontend = `src/`._
_Recompute probe company: Prestige `company_id = 297e37ea-a5ac-47df-bebd-ac44e52b7979`._

## Executive summary

Severity counts (56 findings total, deduplicated):

| Severity | Endpoint | UI | Total |
|----------|---------:|---:|------:|
| Critical | 3 | 0 | 3 |
| High     | 4 | 1 | 5 |
| Medium   | 4 | 7 | 11 |
| Low      | 14 | 14 | 28 |
| Info     | 4 | 5 | 9 |
| **All**  | **29** | **27** | **56** |

The dominant defect is a single root cause — **`masters.products` is not unique on `(company_id, product_external_id, platform)`** (795 duplicate amazon SKU groups for Prestige) — joined as a plain `LEFT JOIN` in five handlers, fanning out review rows. The second root cause is **mixed-case platform / brand values** that survive case-insensitive filters but split case-sensitive `DISTINCT ON` / `GROUP BY` keys, double-counting catalogue rows and brand mentions.

Top 5 "goldmine" issues (one line each):

1. **/summary review KPIs inflated +59% (all) / +95% (amazon)** — `masters.products` + mixed-case snapshot fan-out on every headline review metric (review_count, user/ml rating, sentiment counts). `server/api.cjs:2185-2193`.
2. **/reviews `total` and `data` inflated +57% (amazon)** — duplicate-master fan-out emits each review N times into the row list the frontend aggregates. `server/api.cjs:1634,1663`.
3. **/timeline counts + avgRating inflated +31% (all) / +51% (amazon)** — same duplicate-master fan-out distorts per-month totals and weighted average. `server/api.cjs:2757-2760`.
4. **Competitor-mentions headline overstated +79%** — case-variant brand rows (`hawkins` + `Hawkins`) double-count `total` and split `byBrand`/favorableRate. `server/api.cjs:1952-1960`.
5. **/summary snapshot PDP tiles + /product-categories inflated +8–15%** — mixed-case platform `DISTINCT ON` double-counts `total_ratings`/`total_products` and creates phantom categories. `server/api.cjs:2287`, `1712`.

---

## Critical & High findings (grouped)

### THEME A — `masters.products` plain-JOIN fan-out (duplicate SKU rows)

Root cause: `masters.products` has **795 duplicate `(company_id, product_external_id, platform)` groups** for Prestige (21,050 rows vs 20,255 distinct keys), all on `platform=amazon` (e.g. ASIN `B0D3VH37NV` appears twice). Wherever `ratings.reviews` is joined to `masters.products` via a non-LATERAL `LEFT JOIN` purely to pull fallback category/pareto/price, each review of a duplicated SKU is emitted N times. Flipkart is unaffected (no flipkart duplicates), so the bug is masked under `platform=flipkart` but **active on the default all-platform and amazon views**. The fix is identical in every case: replace the plain join with a `LEFT JOIN LATERAL (... ORDER BY <deterministic tiebreak> LIMIT 1)` (mirroring the existing `product_snapshots` LATERAL), or only join when a price filter is supplied, or dedupe `masters.products` upstream. Long-term: add a UNIQUE constraint on `masters.products(company_id, product_external_id, platform)`.

#### A1 (Critical) — `GET /api/ratings/summary`: review-scope JOIN fan-out inflates all review KPIs
- **Where:** `server/api.cjs:2185-2193` (joins), `2213-2220` (metrics).
- **What's wrong:** `review_scope` LEFT JOINs `ratings.reviews` to BOTH `masters.products` (795 dup groups) AND `latest_snapshots` (mixed-case rows, see Theme B). Both are one-to-many, so every `COUNT(*)`/`AVG`/sentiment-`FILTER` over `filtered_reviews` is inflated and averages are reweighted toward fanned-out products. The `count(DISTINCT web_pid/category)` tiles and the `filtered_products` subqueries are unaffected.
- **Evidence (recomputed vs endpoint, 6-mo window):** all-platforms true 57,383 (avg 3.62) vs endpoint 91,275 (avg 3.45) = **+59%**; amazon true 34,630 (avg 3.37, pos 8,855, neg 4,171) vs endpoint 67,421 (avg 3.25, pos 17,653, neg 9,569) = **+94.7%**; flipkart 22,753 → 23,854 = +4.8%. Isolation: reviews×masters only = 75,155; reviews×snapshots only = 66,030 (each join fans independently).
- **Impact:** Primary dashboard card. review_count, user_rating, ml_rating, positive/negative/neutral counts all overstated 59–95% with skewed averages.
- **Fix:** Dedupe both sources. `resolved_pdp_rating/_count` from these joins are dead (overridden by `pdpMetrics`), so drop the snapshot join from `review_scope` entirely and resolve category/pareto/price from a pre-deduped masters LATERAL/CTE; collapse snapshot case per Theme B.

#### A2 (Critical) — `GET /api/ratings/reviews`: fan-out double-counts `total` and `data`
- **Where:** `server/api.cjs:1634` (data query), `1663` (count query) — identical plain `LEFT JOIN masters.products mp ON mp.company_id=r.company_id AND mp.product_external_id=r.web_pid AND LOWER(mp.platform)=LOWER(r.platform)`.
- **What's wrong:** `mp` supplies only fallback category/material/wattage/pareto/price (SELECT lines 1623-1629), never aggregated, so it must never multiply rows — but it does. Both `total` and the `data` row list are inflated; any client-side review-derived metric over `data` (avg rating, sentiment distribution, histograms) double-counts. The `reviews_ml_audit` join is safe (keyed on unique `review_id`); the `product_snapshots` LATERAL is safe (`ORDER BY snapshot_date DESC LIMIT 1`).
- **Evidence:** amazon clean `COUNT(*)` 269,156 vs endpoint 423,423 = **+154,267 (+57.3%)**; all-Prestige 4,013,175 vs 4,167,442 (+3.8%); flipkart 0 inflation. The endpoint returns up to 100,000 rows with no default pagination, so the inflated `data` is surfaced directly.
- **Fix:** Convert to `LEFT JOIN LATERAL (SELECT ... FROM masters.products mp2 WHERE ... ORDER BY updated_at DESC NULLS LAST LIMIT 1) mp ON true` in BOTH the data query (1634) and count query (1663). After fix amazon `total` = 269,156, all-Prestige = 4,013,175.

#### A3 (Critical) — `GET /api/ratings/timeline`: fan-out inflates counts + weighted avgRating
- **Where:** `server/api.cjs:2757-2760` (the unconditional `LEFT JOIN masters.products mp`).
- **What's wrong:** `mp` exists ONLY to supply `mp.mrp/selling_price/mop` for the optional price filter (lines 2731-2744) yet runs on every request. `COUNT(*)`, the positive/negative/neutral FILTER counts, and `AVG(r.rating)` are all over the fanned-out set, so `totalReviews`, per-category counts, and the JS-weighted `avgRating` are distorted. The `ps` LATERAL (LIMIT 1) cannot fan out — `mp` is the sole cause.
- **Evidence (6-mo):** all-platforms endpoint total 75,155 (pos 20,298, avg 3.51) vs clean 57,383 (pos 15,922, avg 3.62) = **+31%**; amazon endpoint 52,402 (avg 3.30) vs clean 34,630 (avg 3.37) = **+51%**; flipkart unaffected (22,753 = 22,753).
- **Fix:** Only join `masters.products` when a price filter is supplied, and even then via a deduped LATERAL (LIMIT 1, `UPPER(...)`-safe web_pid); otherwise drop it.

#### A4 (High) — `GET /api/ratings/trends`: fan-out inflates counts, shifts neg-rate, admits sub-threshold phantom characteristics
- **Where:** `server/api.cjs:2619-2622` (the `scoped_reviews` plain `LEFT JOIN masters.products mp`); effect at `2640-2648` (COUNT aggregates) and `2664-2665` (`recent_total>=15`/`prior_total>=15` inclusion threshold).
- **What's wrong:** Non-uniform fan-out across reviews means neg/total **rate** shifts (not just scales), and the `>=15` guard admits characteristics with <15 real reviews. The `ps` LATERAL already supplies category/pareto, so `mp` is needed only for price.
- **Evidence:** base 12-mo reviews-alone 613,339 vs with-mp 651,479 (1.062×, concentrated on non-General characteristics). Build Quality recent_total 1905 vs 1428 (+33%), neg_rate 0.3176 vs 0.2843; Stopped Working 1316 vs 930; Recommendation 428/0.1355 vs 350/0.0914. **7 phantom characteristics** admitted only by inflation (real recent_total <15): Electrical Safety 19/0.7895 (real 11), Gasket Issues 22/0.5909 (real 14), Gas Leakage 18 (11), Delivery Issues 16 (10), Budget Friendly 16 (14), Cleaning 19 (11), Price Perception 17 (11). Electrical Safety (neg_rate 0.79) can surface in the escalating "Growth Opportunities" list.
- **Impact:** Corrupts user-facing escalating-issues list on the default scope; false high-neg-rate rows.
- **Fix:** Replace with `LEFT JOIN LATERAL (... ORDER BY mp2.updated_at DESC NULLS LAST LIMIT 1) mp ON true`.

### THEME B — Mixed-case platform survives case-insensitive filters, splits case-sensitive keys

Root cause: `ratings.product_snapshots` still holds stale mixed-case Prestige rows (`'Amazon'` = 1206, `'Flipkart'` = 28, last 2026-04-08) alongside the current lowercase rows. `DISTINCT ON`/`GROUP BY` keys on the **raw** platform keep both case variants as separate rows, while the WHERE/JOIN predicates use `LOWER(...)`/`ILIKE` so both variants pass. The web_pid backfill did NOT fix this (the split is on platform, not web_pid). Fix: key the dedup on `LOWER(ps.platform)` (and defensively `UPPER(ps.web_pid)`) with a matching ORDER BY; long-term, normalize/purge the stale 2026-04-08 rows upstream.

#### B1 (High) — `GET /api/ratings/summary`: snapshot PDP metrics double-count mixed-case platforms
- **Where:** `server/api.cjs:2287` (`DISTINCT ON (ps.company_id, ps.platform, ps.web_pid)`), `2310-2317` (`sum(rating_count)`, `count(*)`), filter via `sc.platform ILIKE $` at `2255`.
- **Evidence:** all-platforms `total_ratings` 30,446,188 vs corrected 28,123,241 (**+2,322,947, +8.3%**), `total_products` 4,943 vs 4,393 (+550); amazon `total_ratings` 10,159,877 vs 8,797,680 (+15.5%), products 2,856 vs 2,334 (+522 = exact `'Amazon'`/`'amazon'` web_pid overlap); flipkart +5.0% / +28 (exact overlap). `avg_platform_rating` only marginally affected (rating_count-weighted, weights cancel).
- **Fix:** `DISTINCT ON (ps.company_id, LOWER(ps.platform), ps.web_pid)` + matching ORDER BY, carry `LOWER(ps.platform)` as the platform column. Shares root cause with A1's snapshot join — fix together.

#### B2 (High) — `GET /api/ratings/product-categories`: mixed-case platform double-counts products + phantom categories
- **Where:** `server/api.cjs:1712` (`DISTINCT ON (ps.company_id, ps.platform, ps.web_pid)`), `1716` (ORDER BY), filter `LOWER(ps.platform)` at `1703`, `COUNT(*)` at `1721`.
- **What's wrong:** Because `'Amazon' != 'amazon'`, the same web_pid is emitted twice; the stale snapshot often held an older/different category, so the duplicate lands in a SECOND category bucket, inflating every category count and creating selectable categories that match no current product.
- **Evidence:** all-platform total 4,717 vs corrected (`LOWER(platform)`, `UPPER(web_pid)`) 4,198 = **519 phantom rows (+12.4%)**, 100% amazon (amazon 2,658 vs 2,139; flipkart 1,547 = 1,547). 228 amazon products counted into >1 category. Per-category: Pressure Cooker 1,183 vs 1,028 (+155), Induction Cooktop 262 vs 151 (+111), Toaster & Otg 41 vs 22 (+19). Phantom categories existing ONLY in stale rows (corrected = 0): Bottles & Flasks (15), Glasstops & Hobs (2), Multi Cooker (2), Uncategorized (1).
- **Fix:** `DISTINCT ON (ps.company_id, LOWER(ps.platform), UPPER(ps.web_pid))` with matching `ORDER BY ... snapshot_date DESC, ps.created_at DESC NULLS LAST` (also fixes the non-deterministic tiebreak, finding M-cat below).

### THEME C — Case-variant brand rows double-count competitor mentions

#### C1 (High) — `GET /api/ratings/competitor-mentions`: case-variant brands double-count `total`, split `byBrand`
- **Where:** `server/api.cjs:1944` (`brand = $idx` case-sensitive filter), `1952-1960` (`GROUP BY brand ORDER BY total DESC`), `1972` (`total = sum(COUNT(*))`). Data source: `scan_competitor_mentions.cjs` writes brand verbatim under a UNIQUE key `(company_id, review_id, brand)`.
- **What's wrong:** The scanner's regex is case-insensitive (`gi`) but stores the brand string verbatim, so the same review/brand is stored under each case variant (`hawkins` AND `Hawkins`) — stale leftovers from a prior scan when masters held upper-case spellings (current brand list is 31 lower-case entries). The endpoint sums both copies into `total` and emits each brand twice in `byBrand`, splitting count and favorableRate. The case-sensitive `brand = $idx` filter is an additional manifestation.
- **Evidence:** whole corpus endpoint `total` 41,807 vs `COUNT(DISTINCT review_id|lower(brand))` 23,385 = **+78.8%**; raw DISTINCT brand 62 vs 31 case-insensitive (exactly 2×). `hawkins` 6,027 rows + `Hawkins` 4,991; the 4,991 reviews carry BOTH = pure duplicates. Flipkart+6-mo: endpoint 360 vs true 231 (+56%); top byBrand = hawkins 51 / pigeon 39 / Hawkins 29 / philips 26 / Pigeon 24 — 4 of top-5 are case variants of 2 real brands.
- **Impact:** Headline metric of the competitor-mentions card is overstated ~79% and the brand ranking is wrong.
- **Fix:** Endpoint: `GROUP BY LOWER(brand)` (select `MIN(brand)`/`LOWER(brand)`), `LOWER(brand)=LOWER($idx)` filter, derive `total` from collapsed groups or `COUNT(DISTINCT review_id||'|'||lower(brand))`. Data: canonicalize brand case before INSERT in `scan_competitor_mentions.cjs` and DELETE rows for brands no longer in the brand list.

### UI High

#### U1 (High) — `TimelineView`: NULL-sentiment reviews relabeled as the real theme "General"
- **Where:** `src/components/TimelineView.tsx:104-116,284-304` (consumer); `server/api.cjs:2781` (`const cat = r.category || 'General'`, where `r.category = r.sentiment_category`).
- **What's wrong:** "General" is in `CATEGORY_ORDER` and rendered as a legitimate sentiment theme, but the endpoint folds every NULL `sentiment_category` into it. Recent months are ~100% NULL, so the chart is essentially 100% "General" and the % contribution / trend pills are meaningless.
- **Evidence:** Prestige `sentiment_category` NULL = 3,445,524 rows vs ~567,651 categorized. Monthly NULL share: 2026-06 100%, 2026-05 100%, 2026-04 90%, 2026-03 37%.
- **Fix:** Server: exclude `WHERE r.sentiment_category IS NOT NULL` or emit an explicit "Uncategorized" bucket. Component: relabel the NULL catch-all "Uncategorized" (distinct from the real "General" theme) so % contribution reflects only classified reviews.

---

## Medium / Low findings (table)

### Medium

| # | Sev | Target | Where | What's wrong / fix |
|---|-----|--------|-------|--------------------|
| M1 | Med | `GET /api/ratings/products` | `api.cjs:1804` (countSql), `1832/1854` | Duplicate `masters.products` rows emitted as separate products (same web_pid/rating/price), 795 dup groups → `total` inflated ~795 and downstream Pareto/rating rollups double-count. Wrap masters in `DISTINCT ON (company_id, product_external_id, platform)` and apply same dedupe in countSql. |
| M2 | Med | `GET /api/ratings/competitor-mentions` | `api.cjs:1950-1969`; `scan_competitor_mentions.cjs:90-128` | Self-brand mentions inflate ~58% — scanner scans ALL reviews (incl. competitor's own products) for brand names; a Hawkins review saying "Hawkins is great" counts as a competitor mention. 24,080/41,807 (58%) are self-brand; 18,850 (45%) from `is_competitor=true` reviews. Exclude self-brand and/or `is_competitor=true`; expose an is_competitor scope filter. |
| M3 | Med | `GET /api/ratings/trends` | `api.cjs:2599-2603` | Default 6-mo recent window (>= 2025-12-30) straddles the 2026-06-21 source swap in `ratings.metric_discontinuities`; the recent-vs-prior negative-rate delta may reflect a source artifact. Add a `straddlesDiscontinuity` flag or clamp to one side, consistent with the alert-engine guard. |
| M4 | Med | `GET /api/ratings/timeline` | `api.cjs:2761-2767` | Price-filter LATERAL selects latest snapshot by `company_id+web_pid` only (no platform/is_competitor), so multi-platform SKUs filter on the wrong platform's price. 460 Prestige web_pids span >1 platform. Add `AND LOWER(ps2.platform)=LOWER(r.platform)` (and is_competitor if scope matters). |
| M5 | Med | `src/components/Dashboard.tsx` | `:218` (and `:144`) | `params.web_pid = filters.sku` sent verbatim with no `.toUpperCase()`; server match is case-sensitive (`r.web_pid = $n`), so non-uppercase SKU input silently returns zero rows and KPIs collapse. Normalize `filters.sku.toUpperCase()` (and `initialSkuSearch`), or make server filter `UPPER(r.web_pid)=UPPER($n)`. |
| M6 | Med | `src/components/InsightsPanel.tsx` | `:25-27,91,135,182,8,100` | Buckets labeled "Characteristics" are actually `sentimentCategory` (8-bucket classification); callback `onCharacteristicClick` passes `item.characteristic`, so a parent filters the wrong dimension. Rename copy to "Categories"/"Themes" and `onCategoryClick`, or actually group by `review.characteristics`. (Latent — component is dead, see I2.) |
| M7 | Med | `src/components/InsightsPanel.tsx` | `:26,59-61` | Catch-all "General" bucket dominates rankings (esp. "Most Discussed", sorted by total count), crowding out real themes. Exclude "General"/empty from rankings or label "Uncategorized". |
| M8 | Med | `src/components/TrendChart.tsx` | `:11-272` (title `:140`) | File named/roled as a time-series `TrendChart` but renders only a static "Competitive Benchmark" (bars/radar/head-to-head) — no date axis, no time bucketing, no trend. Rename to `CompetitiveBenchmark` or implement an actual time-series. (Latent — dead, I5.) |
| M9 | Med | `src/components/TrendChart.tsx` | `:114,124` | Divide-by-zero: Prestige side of head-to-head unguarded; `prestigeReviews.length===0` → `Math.round(NaN*100)%` renders literal "NaN%" (Positive Reviews, Quality Issues), and `parseFloat('NaN%')` makes the win silently go to competitor. Guard Prestige denominators like the competitor branch. |
| M10 | Med | `src/components/TrendChart.tsx` | `:74,83-85,109-110` | Synthetic placeholders shown as real: `r.rating || 3` (rewrites real 0/null → 3), radar quality/value/safety default 50 for zero-review brands, avgRating default 3 → 60% on radar. Use `?? null`, exclude nulls from averages, render n/a for empty axes. |
| M11 | Med | `src/components/TimelineView.tsx` | `:37-46,104-116,120-137` | `CATEGORY_ORDER` omits Customer Service (4,015), Brand (2,502), Competitor (997) — their reviews are never drawn AND excluded from `monthTotal`, yet residual normalization forces bars to 100%, hiding them under the "% contribution" label. Derive category list dynamically from server data; compute `monthTotal` over ALL returned categories. |

### Low

| # | Sev | Target | Where | What's wrong / fix |
|---|-----|--------|-------|--------------------|
| L1 | Low | `GET /api/ratings/reviews` | `api.cjs:1634,1638,1663,1667` | web_pid/`product_external_id` joins are case-sensitive (only platform `LOWER()`'d). OK today (all uppercase) but future non-upper web_pid silently drops enrichment. Use `UPPER(...)=UPPER(...)`. |
| L2 | Low | `GET /api/ratings/product-categories` | `api.cjs:1716` | Latest-snapshot pick has no tiebreak; same-day double snapshots pick category non-deterministically. Append `, ps.created_at DESC NULLS LAST` (combine with B2). |
| L3 | Low | `GET /api/ratings/products` | `api.cjs:1810,1837,1849` | web_pid joins (snapshot + reviews LATERAL) not uppercase-safe; masters has 314 non-upper rows, snapshots 2,296. 0 dropped today but fragile. `UPPER(...)=UPPER(...)` + same in countSql. |
| L4 | Low | `GET /api/ratings/products` | `api.cjs:1824` | Dead COALESCE: `review_count = COALESCE(rv.review_count, p.review_count, 0)` but `rv.review_count` is `COUNT(*)` (never NULL → always 0, never NULL), so masters fallback is unreachable. Use `COALESCE(NULLIF(rv.review_count,0), p.review_count, 0)` or drop the dead branch. |
| L5 | Low | `GET /api/ratings/products` | `api.cjs:1788,1795` (filter) vs `1831` (display) | sp-mode price filter uses a 5-term COALESCE; displayed `price_sp` uses 3 terms (missing `ps.price_rp, p.mrp`), so filtered results disagree with shown prices. Make filter and display identical. |
| L6 | Low | `GET /api/ratings/products` | `api.cjs:1811,1838` | NULL-platform masters rows (15,656) match snapshots of ANY platform via `OR p.platform IS NULL`; rating/price pulled from an arbitrary platform's latest snapshot (30 affected). Resolve to a canonical platform or tie-break by platform. |
| L7 | Low | `POST /api/ml-audit/product-inspect` | `api.cjs:1881-1882,1891` | Empty category dictionary → `validCategories=''` → prompt allow-list `[""]` (model effectively unconstrained). Guard `rows.length===0` (422 or skip the constraint clause). |
| L8 | Low | `POST /api/ml-audit/product-inspect` | `api.cjs:1913-1924` | AI-returned `category` trusted verbatim, no membership check against the dictionary. Bounded today (`persisted:false`) but risky if persistence is wired. Validate `extracted.category` against `validCategories` (case-insensitive) before returning. |
| L9 | Low | `GET /api/ratings/competitor-mentions` | `api.cjs:1953-1956` | favorable/unfavorable/neutral buckets don't partition `total` — gated on `NOT is_favorable AND` specific sentiment string; relies on undocumented writer invariant. Make buckets exhaustive (`neutral = NOT is_favorable AND sentiment<>'Negative'`). |
| L10 | Low | `GET /api/ratings/competitor-mentions` | `scan_competitor_mentions.cjs:118` (→ `api.cjs:1954,1988`) | `classifyContext(bodyLower)` classifies on the whole review body, not the 120-char per-brand snippet; in multi-brand reviews EVERY brand gets the review-level verdict. Classify on the extracted context window per occurrence. |
| L11 | Low | `GET /api/ratings/summary` | `api.cjs:2285-2319,2335-2337` | Catalogue tiles (rating_count/total_ratings/pdp_rating, latest-snapshot all-time) sit beside window-scoped review tiles on one card; same card answers two time questions. Label catalogue tiles "as of latest snapshot" / expose snapshot_date. (Intentional, no SQL change.) |
| L12 | Low | `GET /api/ratings/trends` | `api.cjs:2568` | web_pid query-param filter is case-sensitive `r.web_pid = $n` (unlike platform ILIKE / `LOWER()` joins). Non-upper input → zero rows silently. Use `r.web_pid = UPPER($n)`. |
| L13 | Low | `GET /api/ratings/timeline` | `api.cjs:2759,2764` | mp and price LATERAL compare web_pid without case normalization; mixed-case masters/snapshot rows would silently drop the price match. `UPPER(...)=UPPER(...)`. |
| L14 | Low | `GET /api/ratings/timeline` | `api.cjs:2752-2754` | sentiment NULL for ~60% of reviews; positive+negative+neutral cover only ~40% of `total`, so a stacked chart undercounts. 6-mo: total 57,383, NULL 34,474 (60.1%). Add an "unclassified" bucket or compute shares over classified only. |
| L15 | Low | `src/components/Dashboard.tsx` | `:327-330,489-492` | `isLoading` always includes `summaryLoading`; `useSummary` has no `enabled` gate, so master/rules tabs (which never read `summary`) show a global "Loading data from database..." spinner waiting on unused data. Scope the loading gate to data-driven tabs. |
| L16 | Low | `src/components/Dashboard.tsx` | `:417` | Hardcoded "Prestige Product Analytics" header in a multi-tenant, brandScope-aware app; wrong for non-Prestige company and for competition/all scopes. Drive label from resolved company; annotate active brandScope. |
| L17 | Low | `src/components/InsightsPanel.tsx` | `:59-61,178,180` | `trending` var + TrendingUp icon imply velocity but it's sorted by lifetime total. Rename `mostDiscussed` / non-trend icon (header text "Most Discussed" is accurate). |
| L18 | Low | `src/components/InsightsPanel.tsx` | `:21-64` | No `is_competitor` scoping — blends Prestige + competitor reviews with no disclosure. Filter to intended scope or label it. |
| L19 | Low | `src/components/InsightsPanel.tsx` | `:45,113,141,159` | Bare unlabeled `score*100%` next to "N bad" (and positiveRate in strengths) reads ambiguously. Add "% negative"/"% positive" labels. |
| L20 | Low | `src/components/InsightsPanel.tsx` | `:33-38` | NULL/unknown sentiment falls through to Neutral, inflating neutral and diluting ratios. Skip unknown from denominator or track explicit "unknown". |
| L21 | Low | `src/components/ui/RatingSummary.tsx` | `:10,129-133` | `title` prop declared and passed by callers (RatingSummaryCompare 168/173; SegmentMatrixView:149) but never rendered. Remove or render it. |
| L22 | Low | `src/components/ui/RatingSummary.tsx` | `:152` | `ownLabel` defaults to "Prestige" in a reusable, multi-company component. Make required or company-derived. |
| L23 | Low | `src/components/ui/RatingSummary.tsx` | `:91-92` | DenseRatingSummary (default) over-rounds counts in 1K–100K range (1500→"2K", 12400→"12K") with no exact value/tooltip. Use 1 fraction digit or expose exact via title/aria-label. |
| L24 | Low | `src/components/TrendChart.tsx` | `:49,73,83-85,114,179,182` | Inconsistent "positive" definition: bars/radar count `sentiment Positive OR rating>=4`; radar Q/V/S and head-to-head count sentiment-only — two "% positive" numbers under one label disagree. Pick one definition or relabel. |
| L25 | Low | `src/components/TrendChart.tsx` | `:34,132,204` | Competitor brands silently capped (top 4 overall, top 3 radar) by insertion order, not volume; extras dropped with no UI hint. Rank by review count, extend COLORS, add "+N more". |
| L26 | Low | `src/components/TimelineView.tsx` | `:62,380` | Dead/unwired — no importer; `useTimeline` never called. Wire it (passing serverTimeline) or remove. |
| L27 | Low | `src/components/TimelineView.tsx` | `:25,74-92` | Accepts a `reviews` prop and comment implies a client fallback, but `monthlyData` is built solely from `serverTimeline ?? []`; `reviews` never read → empty chart if serverTimeline absent. Implement the fallback or drop the prop + dep. |
| L28 | Low | `src/components/TimelineView.tsx` | `:150-172,284-304` | Trend arrows never appear in 3m range — `calculateTrend` slices `(-6,-3)` on the already-range-filtered data, returning `[]` when only 3 months exist (guard → "stable"); comparison window is a fixed 3-vs-3 regardless of selected range. Base the comparison window on the selected range. |

### Info

| # | Target | Where | Note |
|---|--------|-------|------|
| I-a | `GET /api/ratings/product-categories` | `api.cjs:1721` | Returned `count` is a product count (distinct products in latest snapshot), not a review count; consumed/summed in `useRatingsAPI.ts:471-489`. Rename to `product_count` / document. Fixing B2 corrects the value. |
| I-b | `POST /api/ml-audit/product-inspect` | `api.cjs:1870-1929` | Endpoint does NOT compute any rating metric (it's a Gemini AI-extraction preview reading only `ratings.ml_dictionary`; `persisted:false`). No rating bug class applies — the audit target mapping is the only thing to correct. |
| I-c | `GET /api/ratings/competitor-mentions` | `api.cjs:1946-1947,1967` | No default date window; 1,475 NULL-`review_date` rows + 2 pre-2000 rows (min 1899-11-29) fold into all-time totals. Apply a default window (e.g. 6 months) like the rest of the dashboard. |
| I-d | `GET /api/ratings/timeline` | `api.cjs:2790-2796` | `avgRating` re-weights pre-rounded 2-dp per-category averages by `COUNT(*)` (includes 34 null-rating rows). Negligible (0.06%) but compute unrounded `AVG` in SQL or weight by `COUNT(rating)`. |
| I-e | `src/components/Dashboard.tsx` | `:375-376` | `positiveRate`/`negativeRate` use `total_reviews` (incl. neutral) as denominator, so they don't sum to 100. Defensible ("% of all reviews") — label clearly or compute over (positive+negative). |
| I-f | `src/components/InsightsPanel.tsx` | `:20,219` | Dead code — exported, never imported (Dashboard renders `ExecutiveInsights`). All M6/M7/L17–L20 issues are latent. Delete or wire up. |
| I-g | `src/components/ui/KpiChipRow.tsx` | `:34` | Purely presentational, no API/fields, no callers. Clean from a correctness standpoint; audit the future caller that builds `items[]`. |
| I-h | `src/components/ui/RatingSummary.tsx` | `:50,72` | `label.replace(' Rating','')` is a dead no-op (labels have no " Rating" substring); inconsistent with Chip. Remove or apply consistently. |
| I-i | `src/components/TrendChart.tsx` | `:1-275` | Dead code — never imported. M8/M9/M10/L24/L25 latent until wired; the misleading `TrendChart` name is a liability. Delete or rename + fix first. |

---

## UI / labeling findings (summary)

- **Wrong-source / mislabeled themes:** `TimelineView` presents NULL `sentiment_category` as the real "General" theme (U1, High) and silently drops 3 real categories from the % denominator (M11). `InsightsPanel` labels `sentimentCategory` buckets as "Characteristics" (M6) and lets the catch-all "General" dominate rankings (M7). `TrendChart` is a benchmark masquerading as a time-series (M8).
- **Synthetic/broken numerics shown as real:** `TrendChart` "NaN%" on empty Prestige scope and silent win mis-attribution (M9); placeholder `rating||3` / radar-50 / avgRating-3 blended into real data (M10).
- **Case-sensitivity in the UI layer:** Dashboard sends `web_pid` verbatim to a case-sensitive server filter (M5).
- **Hardcoded/scope labels:** "Prestige Product Analytics" header (L16); reusable components default to "Prestige" (`ownLabel`, L22).
- **Ratio/label clarity:** positiveRate/negativeRate denominator incl. neutral (I-e); unlabeled pain-point % (L19); inconsistent "% positive" definitions (L24); over-rounded counts (L23).
- **Dead UI code (latent):** `InsightsPanel` (I-f), `TrendChart` (I-i), `KpiChipRow` (I-g), `TimelineView` (L26) are all unwired; their bugs surface only if mounted.
- **Loading/wiring:** master/rules tabs gated on an unused summary fetch (L15); `TimelineView` unused `reviews` prop / missing fallback (L27); trend arrows dead in 3m range (L28); dead props/no-ops (L21, I-h).

---

## Systemic themes

1. **`masters.products` non-unique → plain-JOIN fan-out (the dominant defect).** 795 duplicate `(company_id, product_external_id, platform)` amazon groups for Prestige inflate `/summary` (+59–95%), `/reviews` (+57% amazon), `/timeline` (+31–51%), `/trends` (+6% overall, threshold-breaking on individual characteristics), and `/products` (+795 rows). All amazon; flipkart is the only clean platform, which masked the bug. **One structural fix** (LATERAL-LIMIT-1 / dedupe CTE everywhere `masters.products` is joined to reviews) plus a **UNIQUE constraint** on `masters.products(company_id, product_external_id, platform)` closes the entire class.
2. **Mixed-case platform values (`'Amazon'`/`'Flipkart'`, last 2026-04-08).** Case-insensitive `LOWER()`/`ILIKE` filters admit both variants, but case-sensitive `DISTINCT ON`/`GROUP BY` keys split them, double-counting `/summary` snapshot tiles (+8–15%) and `/product-categories` (+12.4%, plus 4 phantom categories). Fix by keying on `LOWER(platform)` and purging the stale rows upstream.
3. **Case-variant brand rows in `competitor_mentions`.** Same `LOWER()`-vs-raw mismatch on the brand string overstates the competitor headline +79% and splits the brand ranking. Fix the endpoint (`LOWER(brand)`) AND canonicalize at write time in `scan_competitor_mentions.cjs`.
4. **web_pid case fragility (latent, pervasive).** Every reviews↔snapshot/master join and the `/reviews`, `/trends` web_pid filters and the Dashboard SKU param compare web_pid case-sensitively. Currently 0 rows dropped because data is uppercase, but the recent flipkart prices-sync bug (commit d627f73, 3460 vs 237 SKUs) is the same class. Normalize with `UPPER()` on both sides (or at ingest) everywhere.
5. **reviews-vs-snapshots source confusion / window mixing.** Catalogue metrics (rating_count, total_ratings — latest snapshot, all-time) sit beside window-scoped review metrics on the same cards (`/summary` L11). Label catalogue tiles "as of latest snapshot".
6. **2026-06-21 measurement discontinuity not guarded in `/trends`.** Default 6-mo window straddles the source swap; recent-vs-prior deltas can show false swings. Reuse the existing alert-engine discontinuity guard.
7. **NULL-handling / catch-all buckets surfaced as real signal.** NULL sentiment_category → "General" theme (U1), ~60% NULL sentiment under-summing stacked charts (L14), undated competitor mentions in all-time totals (I-c), dead COALESCE fallbacks (L4).

---

## Recommended fix order

1. **Eliminate the `masters.products` fan-out everywhere it touches reviews (Theme A).** One reusable deduped-master LATERAL/CTE applied to `/summary` (A1, `api.cjs:2185-2193`), `/reviews` (A2, `1634`+`1663`), `/timeline` (A3, `2757-2760`), `/trends` (A4, `2619-2622`), and `/products` (M1, `1804`/`1832`/`1854`). Highest blast radius (3 criticals + 1 high + 1 medium), single pattern. Add the UNIQUE constraint as the durable backstop.
2. **Collapse mixed-case platform in snapshot dedup keys (Theme B).** `/summary` pdpMetrics (B1, `2287`) and `/product-categories` (B2, `1712`/`1716`); same change, removes the snapshot half of A1 too. Purge/normalize the stale 2026-04-08 rows upstream.
3. **Case-normalize competitor-mention brands (Theme C, C1)** in the endpoint (`1952-1960`) and canonicalize at write time in `scan_competitor_mentions.cjs`; while there, fix self-brand scope (M2).
4. **Fix `TimelineView` NULL-as-"General" (U1)** and the omitted-categories denominator (M11) — most visible UI correctness defect.
5. **web_pid case-safety sweep (Theme 4):** all joins + filters (L1, L3, L12, L13) and the Dashboard SKU param (M5). Cheap, prevents the next silent-zero incident.
6. **`/trends` discontinuity guard (M3)** and **`/timeline` price-LATERAL platform predicate (M4)**.
7. **Labeling / clarity batch:** L11, L14, I-a, I-c, I-e and UI labels (L16, L19, L22, L23, L24); `TrendChart` NaN/synthetic guards (M9/M10) if it is to be wired.
8. **Dead-code disposition:** delete or wire `InsightsPanel` (I-f), `TrendChart` (I-i), `KpiChipRow` (I-g), `TimelineView` (L26); resolve dead props/no-ops (L4, L21, I-h).
