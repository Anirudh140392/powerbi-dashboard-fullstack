import * as dotenv from 'dotenv';
dotenv.config();

import { 
    getPrimaryMOM, 
    getPrimaryQuarterly, 
    getPrimaryPivotTable, 
    getPrimaryFilterOptions 
} from './src/services/primarySalesService.js';
import { setCurrentDbName } from './src/config/clickhouse.js';

async function run() {
    try {
        // Set the active database name to 'drl' so client resolves queries correctly
        setCurrentDbName('drl');
        console.log("Setting DB name to 'drl'");

        console.log("\n--- Testing getPrimaryFilterOptions ---");
        const filters = await getPrimaryFilterOptions();
        console.log("Filter options keys:", Object.keys(filters));
        console.log("Sample Brand options (first 5):", filters.brandName.slice(0, 5));
        console.log("Sample Retailer options (first 5):", filters.retailerName.slice(0, 5));
        console.log("Sample Product options (first 5):", filters.product.slice(0, 5));
        console.log("Sample Division options:", filters.division);
        console.log("Sample Zone options:", filters.zone);
        console.log("Sample Location options:", filters.location);
        console.log("Sample Channel options:", filters.channel);
        console.log("Sample Platform options:", filters.platform);

        console.log("\n--- Testing getPrimaryMOM ---");
        const mom = await getPrimaryMOM({ brandName: 'All', retailerName: 'All' });
        console.log("MOM data count:", mom.length);
        console.log("Sample MOM data (first 5):", mom.slice(0, 5));

        console.log("\n--- Testing getPrimaryQuarterly ---");
        const quarterly = await getPrimaryQuarterly({ brandName: 'All', retailerName: 'All' });
        console.log("Quarterly data count:", quarterly.length);
        console.log("Sample Quarterly data (first 5):", quarterly.slice(0, 5));

        console.log("\n--- Testing getPrimaryPivotTable (Retailer Name) ---");
        const pivotRetailer = await getPrimaryPivotTable({ brandName: 'All' }, 'Retailer Name');
        console.log("Pivot Retailer columns (months):", pivotRetailer.months);
        console.log("Pivot Retailer rows count:", pivotRetailer.data.length);
        console.log("Sample Pivot Retailer row:", pivotRetailer.data[0]);

        console.log("\n--- Testing getPrimaryPivotTable (Brand Name) ---");
        const pivotBrand = await getPrimaryPivotTable({ retailerName: 'All' }, 'Brand Name');
        console.log("Pivot Brand rows count:", pivotBrand.data.length);
        console.log("Sample Pivot Brand row:", pivotBrand.data[0]);

        console.log("\nAll tests passed successfully!");
        process.exit(0);
    } catch (e) {
        console.error("Test failed:", e);
        process.exit(1);
    }
}

run();
