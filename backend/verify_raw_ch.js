
import { queryClickHouse } from './src/services/watchTowerService.js';

async function verifyRawData() {
    console.log("Verifying raw data from rca_pm_olap...");

    // Sample query for Jan 2025
    const q = `
        SELECT 
            SUM(ad_quantity_sold) as total_orders,
            SUM(impressions) as total_impressions,
            (SUM(ad_quantity_sold) / NULLIF(SUM(impressions), 0)) * 100 as calculated_conversion
        FROM rca_pm_olap
        WHERE DATE BETWEEN '2025-01-01' AND '2025-01-31'
    `;

    try {
        const result = await queryClickHouse(q);
        console.log("ClickHouse Raw Result (Jan 2025):", JSON.stringify(result, null, 2));
    } catch (error) {
        console.error("ClickHouse Query Error:", error);
    }
    process.exit(0);
}

verifyRawData();
