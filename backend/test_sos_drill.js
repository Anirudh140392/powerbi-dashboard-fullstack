import { getEcomRcaData } from './src/services/ecomRcaService.js';

async function test() {
    console.log("--- Level 1: Brand ---");
    const d1 = await getEcomRcaData({ kpiCategory: 'Share of Search Overall', drilldownLevel: 'brand' });
    console.log(d1.rows.slice(0, 2));

    console.log("\n--- Level 2: SKU (should be Keyword) ---");
    const d2 = await getEcomRcaData({ kpiCategory: 'Share of Search Overall', drilldownLevel: 'sku', drilldownId: 'm&m' });
    console.log(d2.rows.slice(0, 2));

    console.log("\n--- Level 3: Location ---");
    const d3 = await getEcomRcaData({ kpiCategory: 'Share of Search Overall', drilldownLevel: 'location', drilldownId: 'chocolate' });
    console.log(d3.rows.slice(0, 2));
}

test().catch(console.error);
