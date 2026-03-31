
import { getPmConversion, getWatchtowerMonthOverview, getWatchtowerCategoryOverview } from './src/services/watchTowerService.js';
import dayjs from 'dayjs';

async function test() {
    console.log("Starting Verification of Conversion KPI Fixes...");

    const startDate = dayjs('2025-01-01');
    const endDate = dayjs('2025-01-31');
    const filters = {
        platform: 'Zepto',
        brand: 'Cinthol',
        category: 'Soaps',
        location: 'All'
    };

    try {
        console.log("\n1. Testing getPmConversion...");
        const pmConv = await getPmConversion(startDate, endDate, 'Zepto', 'Cinthol', 'All', 'Soaps');
        console.log("PM Conversion Result:", pmConv);

        console.log("\n2. Testing getWatchtowerMonthOverview...");
        const monthOverview = await getWatchtowerMonthOverview(startDate, endDate, 'Zepto', 'Cinthol', 'All', 'Soaps', filters);
        if (monthOverview && monthOverview.length > 0) {
            const firstMonth = monthOverview[0];
            const convCol = firstMonth.columns.find(c => c.title === "Conversion");
            console.log("Month Overview First Month Conversion:", convCol?.value);
        } else {
            console.log("No data returned for Month Overview");
        }

        console.log("\n3. Testing getWatchtowerCategoryOverview...");
        const catOverview = await getWatchtowerCategoryOverview(startDate, endDate, 'Zepto', 'Cinthol', 'All', 'Soaps', filters);
        if (catOverview && catOverview.length > 0) {
            const firstCat = catOverview[0];
            const convCol = firstCat.columns.find(c => c.title === "Conversion");
            console.log("Category Overview First Category Conversion:", convCol?.value);
        } else {
            console.log("No data returned for Category Overview");
        }

    } catch (error) {
        console.error("Verification Error:", error);
    }
    process.exit(0);
}

test();
