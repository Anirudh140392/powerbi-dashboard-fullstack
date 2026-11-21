import { queryAdminDB } from '../config/adminClickhouse.js';

async function testScenario(name, threshold, skuScope) {
    console.log(`\n========================================`);
    console.log(`TEST: ${name} (threshold=${threshold}%, skuScope=${skuScope})`);
    console.log(`========================================`);

    const dbName = 'emami';
    const isRolling = false;
    const pct = (threshold / 100).toFixed(2);

    let emamiSkuFilter = '';
    if (skuScope === 'all_sku') {
        emamiSkuFilter = `AND lower(Web_Pid) IN (SELECT lower(web_pid) FROM \`${dbName}\`.rb_sku_platform WHERE is_competitor = 0)`;
    } else {
        emamiSkuFilter = `AND lower(Web_Pid) IN (SELECT lower(web_pid) FROM \`${dbName}\`.rb_sku_platform WHERE emsl_flag = '1')`;
    }

    const pdpQuery = `
        WITH
            latest_date AS (
                SELECT MAX(DATE) AS max_date
                FROM \`${dbName}\`.rb_pdp_olap
                WHERE DATE IS NOT NULL AND Comp_flag = 0
            ),
            week_boundaries AS (
                SELECT
                    max_date,
                    subtractDays(max_date, toDayOfWeek(max_date) % 7 + 7) AS current_week_start
                FROM latest_date
            ),
            weekly_product_stats AS (
                SELECT
                    Platform, Web_Pid, any(Product) AS sku_name,
                    if(lower(Web_Pid) IN (SELECT lower(web_pid) FROM \`${dbName}\`.rb_sku_platform WHERE emsl_flag = '1'), 1, 0) AS is_msl,
                    subtractDays(DATE, toDayOfWeek(DATE) % 7) AS week_start,
                    sum(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) AS neno,
                    sum(ifNull(toFloat64OrZero(toString(deno_osa)), 0)) AS deno
                FROM \`${dbName}\`.rb_pdp_olap
                WHERE DATE IS NOT NULL AND Comp_flag = 0
                  AND Product IS NOT NULL AND lower(Product) NOT IN ('other', 'others', 'null', 'undefined', '')
                  ${emamiSkuFilter}
                GROUP BY Platform, Web_Pid, week_start
            ),
            weekly_osa AS (
                SELECT
                    Platform, Web_Pid, sku_name AS Product, is_msl AS msl, week_start,
                    if(deno > 0, neno / deno * 100, 100) AS osa
                FROM weekly_product_stats
            ),
            current_week AS (
                SELECT w.Platform, w.Web_Pid, w.Product, w.msl, w.osa
                FROM weekly_osa w
                CROSS JOIN week_boundaries b
                WHERE w.week_start = b.current_week_start
            ),
            pw_product AS (
                SELECT w.Platform, w.Web_Pid, w.osa AS pw_avg
                FROM weekly_osa w
                CROSS JOIN week_boundaries b
                WHERE w.week_start = b.current_week_start - INTERVAL 7 DAY
                GROUP BY w.Platform, w.Web_Pid, w.osa
            ),
            product_metrics AS (
                SELECT
                    c.Platform, c.Web_Pid, c.Product, c.msl, c.osa, l.pw_avg, c.osa - l.pw_avg AS delta
                FROM current_week c
                LEFT JOIN pw_product l ON c.Platform = l.Platform AND c.Web_Pid = l.Web_Pid
            ),
            bottom_threshold AS (
                SELECT Platform, quantile(${pct})(osa) AS threshold
                FROM product_metrics
                GROUP BY Platform
            )
        SELECT
            m.Platform, m.Web_Pid, m.Product, m.msl, m.osa, m.pw_avg, m.delta, t.threshold
        FROM product_metrics m
        INNER JOIN bottom_threshold t ON m.Platform = t.Platform
        WHERE m.osa <= t.threshold AND (m.osa > 0 OR t.threshold = 0)
        ORDER BY m.Platform, m.osa ASC
        LIMIT 5 BY m.Platform
    `;

    const res = await queryAdminDB(pdpQuery);
    console.table(res.map(r => ({
        Platform: r.Platform,
        Product: r.Product,
        CW_OSA: r.osa + '%',
        PW_OSA: (r.pw_avg || 0) + '%',
        Delta: (r.delta || 0) + '%',
        MSL: r.msl == 1 ? 'pareto' : 'non-pareto',
        Threshold: r.threshold
    })));
}

async function main() {
    // 1. Current scenario from user screenshot (threshold=1, all_sku)
    await testScenario("User Current Setup", 1, "all_sku");

    // 2. User setup with top_sku instead of all_sku
    await testScenario("With Top SKU", 1, "top_sku");

    // 3. Realistic threshold (20%) with top_sku
    await testScenario("Realistic (20% threshold + Top SKU)", 20, "top_sku");

    // 4. Realistic threshold (20%) with all_sku
    await testScenario("Realistic (20% threshold + All SKU)", 20, "all_sku");

    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
