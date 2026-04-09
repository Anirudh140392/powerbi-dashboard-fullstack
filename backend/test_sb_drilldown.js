import { getEcomRcaData } from './src/services/ecomRcaService.js';

async function testSB() {
    try {
        console.log("Fetching drilldown for Sponsored Brand...");
        const result = await getEcomRcaData({
            platform: 'Amazon',
            kpiCategory: 'Sponsored Search',
            drilldownLevel: 'brand',
            activeTab: 'all',  // or gainers/drainers
            month: '2024-03-01'  // Ensure this has data
        });
        
        console.log(`Found ${result.rows?.length || 0} rows.`);
        if (result.rows && result.rows.length > 0) {
            console.log("Top 3 Rows:");
            console.log(result.rows.slice(0, 3));
        } else {
            console.log("No data returned. Maybe adjust date.");
        }
    } catch (err) {
        console.error("Error:", err);
    }
}
testSB();
