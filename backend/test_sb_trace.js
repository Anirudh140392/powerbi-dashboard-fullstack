import { getEcomRcaData } from './src/services/ecomRcaService.js';

async function testTrace() {
    try {
        console.log("Fetching drilldown for Sponsored Search...");
        const result = await getEcomRcaData({
            platform: 'Amazon',
            kpiCategory: 'Sponsored Search',
            drilldownLevel: 'brand',
            activeTab: 'all',  // or gainers/drainers
            month: '2024-03-01'  // Ensure this has data
        });
        
        console.log(`Found ${result.rows?.length || 0} rows.`);
        if (result.rows && result.rows.length > 0) {
            console.log("Top 3 Rows:", result.rows.slice(0, 3));
        } else {
            console.log("No data returned. Maybe adjust date.");
        }
        process.exit(0);
    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
}
testTrace();
