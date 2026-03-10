import { queryClickHouse } from './src/config/clickhouse.js';

(async () => {
    try {
        console.log("Checking sample values of metrics:");
        const query = `
            SELECT 
                nation_level_market_share,
                mrp,
                toTypeName(nation_level_market_share) as type_share,
                toTypeName(mrp) as type_mrp
            FROM rb_brand_ms
            WHERE nation_level_market_share != ''
            LIMIT 5
        `;
        const results = await queryClickHouse(query);
        console.log(JSON.stringify(results, null, 2));

    } catch (e) {
        console.error("FAILED:", e.message);
    }
    process.exit();
})();
