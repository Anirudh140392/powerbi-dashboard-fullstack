# Backend Review and SKU Metric Queries

This document captures the backend SQL logic used to compute:
- total review count
- average review rating
- SKU/product metrics
- platform rating totals and averages

All queries are taken from `server_api_original.cjs`.

---

## 1) `GET /api/ratings/products`

This endpoint returns SKU/product rows with both master product fields and aggregated review metrics.

### A) How the latest snapshot is retrieved
The endpoint uses a lateral join to select the most recent `ratings.product_snapshots` entry for each product.

```sql
LEFT JOIN LATERAL (
    SELECT ps2.price_rp, ps2.price_sp, ps2.rating, ps2.rating_count
    FROM ratings.product_snapshots ps2
    WHERE ps2.company_id = p.company_id
      AND ps2.web_pid = p.product_external_id
      AND (LOWER(ps2.platform) = LOWER(p.platform) OR p.platform IS NULL)
    ORDER BY ps2.snapshot_date DESC, ps2.created_at DESC NULLS LAST
    LIMIT 1
) ps ON true
```

### B) How per-product review aggregates are computed
A second lateral join aggregates `ratings.reviews` for the product.

```sql
LEFT JOIN LATERAL (
    SELECT
        COUNT(*) AS review_count,
        ROUND(AVG(rv.rating)::numeric, 2) AS user_rating,
        ROUND(AVG(rv.ml_inferred_rating)::numeric, 2) AS ml_rating
    FROM ratings.reviews rv
    WHERE rv.company_id = p.company_id
      AND rv.web_pid = p.product_external_id
      AND (LOWER(rv.platform) = LOWER(p.platform) OR p.platform IS NULL)
      AND rv.is_competitor = COALESCE(p.is_competitor, false)
) rv ON true
```

### C) Main product query
The query returns the product row plus snapshot and review aggregates.

```sql
SELECT
    p.id,
    p.product_external_id,
    p.product_name,
    p.description,
    p.brand_name,
    p.category_path,
    p.platform,
    p.asin,
    COALESCE(ps.rating, p.rating) AS rating,
    COALESCE(rv.review_count, p.review_count, 0) AS review_count,
    ps.rating_count,
    rv.user_rating,
    rv.ml_rating,
    p.pareto_status,
    p.material,
    p.wattage,
    p.capacity,
    p.litre,
    p.master_category,
    p.category,
    p.business_segment,
    p.sku_code,
    p.mrp,
    p.mop,
    p.is_competitor,
    COALESCE(ps.price_rp, p.mrp) AS price_rp,
    COALESCE(ps.price_sp, p.selling_price, p.mop) AS price_sp
FROM masters.products p
LEFT JOIN LATERAL (
    SELECT ps2.price_rp, ps2.price_sp, ps2.rating, ps2.rating_count
    FROM ratings.product_snapshots ps2
    WHERE ps2.company_id = p.company_id
      AND ps2.web_pid = p.product_external_id
      AND (LOWER(ps2.platform) = LOWER(p.platform) OR p.platform IS NULL)
    ORDER BY ps2.snapshot_date DESC, ps2.created_at DESC NULLS LAST
    LIMIT 1
) ps ON true
LEFT JOIN LATERAL (
    SELECT
        COUNT(*) AS review_count,
        ROUND(AVG(rv.rating)::numeric, 2) AS user_rating,
        ROUND(AVG(rv.ml_inferred_rating)::numeric, 2) AS ml_rating
    FROM ratings.reviews rv
    WHERE rv.company_id = p.company_id
      AND rv.web_pid = p.product_external_id
      AND (LOWER(rv.platform) = LOWER(p.platform) OR p.platform IS NULL)
      AND rv.is_competitor = COALESCE(p.is_competitor, false)
) rv ON true
WHERE <filter conditions>
ORDER BY p.product_name
LIMIT $N OFFSET $M;
```

### D) Result field meaning
- `rating`: latest PDP snapshot rating (`ps.rating`) or fallback `p.rating`.
- `review_count`: count of matching reviews from `ratings.reviews`, or fallback `p.review_count`.
- `rating_count`: platform rating count from the latest snapshot record (`ps.rating_count`).
- `user_rating`: average review rating across matching `ratings.reviews` rows.
- `ml_rating`: average machine-inferred rating across matching `ratings.reviews` rows.

---

## 2) `GET /api/ratings/summary`

This endpoint aggregates review-level metrics and platform rating totals for the current company.

### A) `latest_snapshots` CTE
The query first computes the latest snapshot per product and platform.

```sql
WITH latest_snapshots AS (
    SELECT DISTINCT ON (ps.company_id, ps.platform, ps.web_pid)
        ps.company_id,
        ps.platform,
        ps.web_pid,
        ps.price_rp,
        ps.price_sp,
        ps.rating,
        ps.rating_count,
        ps.review_count,
        ps.category,
        ps.pareto_status
    FROM ratings.product_snapshots ps
    WHERE ps.company_id = $1
    ORDER BY ps.company_id, ps.platform, ps.web_pid,
             ps.snapshot_date DESC, ps.created_at DESC NULLS LAST
),
```

### B) `review_scope` CTE
`review_scope` enriches `ratings.reviews` with resolved category, pareto status, material, price, and PDP snapshot values.

```sql
review_scope AS (
    SELECT
        r.*,
        COALESCE(NULLIF(ls.category, ''), NULLIF(r.category, ''), NULLIF(mp.category, '')) AS resolved_category,
        COALESCE(NULLIF(mp.pareto_status, ''), NULLIF(ls.pareto_status, ''), NULLIF(r.pareto_status, '')) AS resolved_pareto_status,
        COALESCE(NULLIF(mp.material, ''), NULLIF(r.material, '')) AS resolved_material,
        COALESCE(ls.price_rp, mp.mrp) AS resolved_price_rp,
        COALESCE(ls.price_sp, mp.selling_price, mp.mop) AS resolved_price_sp,
        mp.mrp AS base_mrp,
        mp.selling_price AS base_selling_price,
        mp.mop AS base_mop,
        ls.rating AS resolved_pdp_rating,
        ls.rating_count AS resolved_pdp_rating_count
    FROM ratings.reviews r
    LEFT JOIN masters.products mp
        ON mp.company_id = r.company_id
       AND mp.product_external_id = r.web_pid
       AND LOWER(mp.platform) = LOWER(r.platform)
    LEFT JOIN latest_snapshots ls
        ON ls.company_id = r.company_id
       AND ls.web_pid = r.web_pid
       AND LOWER(ls.platform) = LOWER(r.platform)
)
```

### C) Final summary query
The summary query applies filters to `review_scope`, then computes both review aggregates and product-level platform rating aggregates.

```sql
WITH
filtered_reviews AS (
    SELECT *
    FROM review_scope rs
    WHERE <filter conditions>
),
filtered_products AS (
    SELECT DISTINCT
        fr.web_pid,
        fr.platform,
        fr.resolved_pdp_rating,
        fr.resolved_pdp_rating_count
    FROM filtered_reviews fr
)
SELECT
    count(*)::text AS total_reviews,
    round(avg(fr.rating)::numeric, 2)::text AS avg_review_rating,
    round(avg(fr.ml_inferred_rating)::numeric, 2)::text AS avg_ml_rating,
    count(DISTINCT fr.web_pid)::text AS unique_products,
    count(DISTINCT fr.resolved_category)::text AS unique_categories,
    count(*) FILTER (WHERE fr.sentiment = 'Positive')::text AS positive_count,
    count(*) FILTER (WHERE fr.sentiment = 'Negative')::text AS negative_count,
    count(*) FILTER (WHERE fr.sentiment = 'Neutral')::text AS neutral_count,
    COALESCE((
        SELECT sum(COALESCE(fp.resolved_pdp_rating_count, 0))::text
        FROM filtered_products fp
    ), '0') AS total_ratings,
    (
        SELECT round(
            sum(COALESCE(fp.resolved_pdp_rating, 0) * COALESCE(fp.resolved_pdp_rating_count, 0))
            / NULLIF(sum(COALESCE(fp.resolved_pdp_rating_count, 0)), 0)::numeric,
            2
        )::text
        FROM filtered_products fp
    ) AS avg_platform_rating,
    COALESCE((SELECT count(*)::text FROM filtered_products), '0') AS total_products
FROM filtered_reviews fr;
```

### D) Response mapping
The backend maps query results to response metrics like this:

```js
metrics: {
    ...metrics,
    user_rating: metrics.avg_review_rating || null,
    ml_rating: metrics.avg_ml_rating || null,
    pdp_rating: metrics.avg_platform_rating || null,
    review_count: metrics.total_reviews || '0',
    rating_count: metrics.total_ratings || '0',
}
```

---

## 3) Meaning of key metrics

- `total_reviews`: count of filtered rows in `ratings.reviews`.
- `avg_review_rating`: average of review-level `rating` values.
- `avg_ml_rating`: average of review-level `ml_inferred_rating` values.
- `total_ratings`: sum of `resolved_pdp_rating_count` across distinct filtered products.
- `avg_platform_rating`: weighted average of `resolved_pdp_rating` using `resolved_pdp_rating_count`.
- `review_count` (SKU/product row): count of reviews for that product, or fallback `p.review_count` from the master product table.
- `rating_count` (SKU/product row): platform rating count from the latest snapshot record.

## 4) Important notes

- `products` uses latest snapshot data from `ratings.product_snapshots` via lateral joins.
- `summary` resolves data from reviews, product master records, and snapshots to produce consistent category/price/pareto values.
- `rating_count` in `summary` is not the same as `total_reviews`; it is driven by platform rating counts, not review row count.

## 5) UI metric mapping

### Product row metrics (`GET /api/ratings/products`)

- `rating`
  - calculated as `COALESCE(ps.rating, p.rating)`
  - source: latest `ratings.product_snapshots.rating`, fallback `masters.products.rating`

- `review_count`
  - calculated as `COALESCE(NULLIF(rv.review_count, 0), p.review_count, 0)`
  - source: `rv.review_count` from `ratings.reviews` (`COUNT(*)`)
  - fallback: `masters.products.review_count`

- `rating_count`
  - source: latest `ratings.product_snapshots.rating_count`

- `user_rating`
  - source: `ratings.reviews` average rating
  - expression: `ROUND(AVG(rv.rating)::numeric, 2)`

- `ml_rating`
  - source: `ratings.reviews` average machine-inferred rating
  - expression: `ROUND(AVG(rv.ml_inferred_rating)::numeric, 2)`

### Summary metrics (`GET /api/ratings/summary`)

The summary endpoint returns review-derived metrics plus separate snapshot-derived PDP metrics.

- `review_count`
  - source: filtered `ratings.reviews`
  - expression: `count(*)::text` from `filtered_reviews`

- `user_rating`
  - source: filtered `ratings.reviews`
  - expression: `round(avg(fr.rating)::numeric, 2)::text`

- `ml_rating`
  - source: filtered `ratings.reviews`
  - expression: `round(avg(fr.ml_inferred_rating)::numeric, 2)::text`

- `rating_count`
  - source: latest `ratings.product_snapshots` in the separate `snapRes` query
  - expression: `COALESCE(sum(COALESCE(sc.rating_count, 0)), 0)::text`

- `pdp_rating`
  - source: latest `ratings.product_snapshots` in the separate `snapRes` query
  - expression: `round(sum(COALESCE(sc.rating, 0) * COALESCE(sc.rating_count, 0)) / NULLIF(sum(COALESCE(sc.rating_count, 0)), 0)::numeric, 2)::text`

- `avg_platform_rating`
  - same as `pdp_rating`, computed from snapshot rating weighted by `rating_count`

### Snapshot source notes

- The summary endpoint uses a dedicated `latest_snapshots` CTE on `ratings.product_snapshots` and then computes PDP metrics from the resolved snapshot rows.
- This avoids deriving `rating_count` and `pdp_rating` directly from the review-window query, which would be incorrect for catalogue-level snapshot totals.
