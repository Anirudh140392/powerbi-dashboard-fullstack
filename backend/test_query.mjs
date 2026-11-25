import { createClient } from '@clickhouse/client';

const client = createClient({
  url: 'http://localhost:8123',
});

const q = `
WITH latest_snapshots AS (
    SELECT *
    FROM (
        SELECT web_pid, platform, is_competitor,
               rating, rating_count, pareto_status, star_distribution
        FROM product_snapshots
        WHERE company_id = '297e37ea-a5ac-47df-bebd-ac44e52b7979'
          AND snapshot_date >= subtractMonths(today(), 3)
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
            WHEN ls.rating IS NULL                                                      THEN 'NoRating'
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
`;

async function run() {
    const rs = await client.query({ query: q, format: 'JSONEachRow' });
    const data = await rs.json();
    console.log(data);
}

run().catch(console.error);
