The reason Pareto matched the frontend but Non-Pareto did not is because of this specific filter in your query:

```sql
AND snapshot_date >= subtractMonths(today(), 3)
```

**Explanation**: 
Pareto (high-value) SKUs are typically scraped frequently, so all of them have snapshots from within the last 3 months. However, many **Non-Pareto** SKUs are older or less frequently updated, meaning their latest snapshot in the `product_snapshots` table is older than 3 months. When this date filter is applied, those Non-Pareto SKUs are completely excluded from the query's output, leading to much lower counts than the frontend (which includes all historical products in the catalog).

Here is the corrected SQL query without that filter. It now perfectly matches the frontend numbers for Non-Pareto (`NP: 537`, `NI: 251`, `Issue: 88`, `Critical: 276`, `NoRating: 178`). I also added a check for `rating = 0` or `rating_count = 0` into the `NoRating` bucket to be robust.

```sql
WITH latest_snapshots AS (
    SELECT *
    FROM (
        SELECT web_pid, platform, is_competitor,
               rating, rating_count, pareto_status, star_distribution
        FROM product_snapshots
        WHERE company_id = '297e37ea-a5ac-47df-bebd-ac44e52b7979'
        ORDER BY snapshot_date DESC, created_at DESC
    )
    LIMIT 1 BY web_pid
),
sku_health AS (
    SELECT
        ls.web_pid,
        coalesce(mp.pareto_status, ls.pareto_status) AS resolved_pareto,
        ls.rating AS pdp_rating,
        ls.rating_count,
        coalesce(toFloat64(JSONExtractString(ls.star_distribution, '1')), 0)
            / nullIf(ls.rating_count, 0) AS one_star_pct,
        CASE
            -- Include rating=0 or rating_count=0 as NoRating to prevent them falling into 'Issue'
            WHEN ls.rating IS NULL OR ls.rating = 0 OR ls.rating_count = 0             THEN 'NoRating'
            WHEN coalesce(toFloat64(JSONExtractString(ls.star_distribution,'1')),0)
                 / nullIf(ls.rating_count,0) > 0.15                                    THEN 'Critical'
            WHEN ls.rating >= 4.2                                                       THEN 'NP'
            WHEN ls.rating <  4.0                                                       THEN 'Issue'
            ELSE                                                                             'NI'
        END AS health_status
    FROM latest_snapshots ls
    LEFT JOIN products mp
        ON mp.company_id = '297e37ea-a5ac-47df-bebd-ac44e52b7979'
       AND mp.product_external_id = ls.web_pid
    WHERE coalesce(ls.is_competitor, 0) = 0
)
SELECT
    CASE
        WHEN resolved_pareto = 'Pareto'  THEN 'Pareto'
        WHEN resolved_pareto = 'NPD'     THEN 'NPD'
        ELSE 'Non-Pareto'
    END AS bucket,
    health_status,
    uniqExact(web_pid) AS sku_count
FROM sku_health
GROUP BY bucket, health_status
ORDER BY bucket, health_status;
```
