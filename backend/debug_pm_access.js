import dotenv from 'dotenv';
dotenv.config();
import fs from 'fs';
import { queryClickHouse } from './src/config/clickhouse.js';

const runDebug = async () => {
    try {
        console.log("🔍 Debugging ClickHouse Queries for Performance Marketing");

        const platform = 'Zepto';
        const zone = 'Pan India';
        const startDate = '2025-12-01';
        const endDate = '2025-12-31';

        console.log(`\nPARAMS: Platform='${platform}', Zone='${zone}', Date='${startDate}' to '${endDate}'`);

        // Check columns that might be null
        const nullCheckQuery = `
            SELECT 
                count(*) as total,
                countIf(keyword_type IS NULL) as null_type,
                countIf(keyword_name IS NULL) as null_name,
                countIf(keyword_category IS NULL) as null_cat
            FROM tb_zepto_pm_keyword_rca 
            WHERE lower(Platform) = lower('${platform}')
            AND lower(zone) = lower('${zone}')
            AND date BETWEEN '${startDate}' AND '${endDate}'
        `;
        const nullResult = await queryClickHouse(nullCheckQuery);

        // Check distinct keyword_type
        const typeQuery = `
             SELECT DISTINCT keyword_type
             FROM tb_zepto_pm_keyword_rca 
             WHERE lower(Platform) = lower('${platform}')
             AND lower(zone) = lower('${zone}')
             AND date BETWEEN '${startDate}' AND '${endDate}'
        `;
        const typeResult = await queryClickHouse(typeQuery);

        // Check Format Performance Query
        const formatQuery = `
             SELECT 
                keyword_category as Category,
                date,
                SUM(impressions) as impressions
             FROM tb_zepto_pm_keyword_rca 
             WHERE lower(Platform) = lower('${platform}')
             AND lower(zone) = lower('${zone}')
             AND date BETWEEN '${startDate}' AND '${endDate}'
             GROUP BY keyword_category, date
             LIMIT 5
        `;
        const formatResult = await queryClickHouse(formatQuery);

        // Check distinct acos_spend_class
        const spendClassQuery = `
             SELECT DISTINCT acos_spend_class
             FROM tb_zepto_pm_keyword_rca 
             WHERE lower(Platform) = lower('${platform}')
             AND lower(zone) = lower('${zone}')
             AND date BETWEEN '${startDate}' AND '${endDate}'
        `;
        const spendClassResult = await queryClickHouse(spendClassQuery);

        // Check match count for target categories
        const targetCats = ['bath & body', 'detergent', 'hair care', 'fragrance & talc'];
        const matchQuery = `
             SELECT count(*) as count
             FROM tb_zepto_pm_keyword_rca 
             WHERE lower(Platform) = lower('${platform}')
             AND lower(zone) = lower('${zone}')
             AND date BETWEEN '${startDate}' AND '${endDate}'
             AND lower(keyword_category) IN (${targetCats.map(c => `'${c}'`).join(',')})
        `;
        const matchResult = await queryClickHouse(matchQuery);

        // Check match count for target categories AND keyword_type IS NOT NULL (for Heatmap)
        const heatmapQuery = `
             SELECT count(*) as count
             FROM tb_zepto_pm_keyword_rca 
             WHERE lower(Platform) = lower('${platform}')
             AND lower(zone) = lower('${zone}')
             AND date BETWEEN '${startDate}' AND '${endDate}'
             AND keyword_type IS NOT NULL
             AND lower(keyword_category) IN (${targetCats.map(c => `'${c}'`).join(',')})
        `;
        const heatmapResult = await queryClickHouse(heatmapQuery);

        const output = {
            nullResult,
            typeResult,
            formatResult,
            spendClassResult,
            matchResult,
            heatmapResult
        };
        fs.writeFileSync('debug_result.json', JSON.stringify(output, null, 2));
        console.log("✅ Written results to debug_result.json");

    } catch (error) {
        console.error("❌ Error running debug script:", error);
    }
};

runDebug();
