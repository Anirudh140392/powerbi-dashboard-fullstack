import dotenv from 'dotenv';
dotenv.config();
import { getPrimaryLatestDate, getPrimaryKpis, getPrimaryMOM, getPrimaryQuarterly, getPrimaryPivotTable } from './src/services/primarySalesService.js';
import { getSecondaryLatestDate, getSecondarySellerWise, getSecondaryQuarterWise, getSecondaryTopBrands, getSecondarySalesTimeline } from './src/services/secondarySalesService.js';

async function testAPIs() {
    try {
        console.log("=== Testing Primary Sales Service ===");
        const pDates = await getPrimaryLatestDate();
        console.log("Primary dates:", pDates);

        const pParams = {
            startDate: pDates.defaultStartDate,
            endDate: pDates.defaultEndDate,
            brandName: 'All',
            retailerName: 'All',
            product: 'All',
            division: 'All',
            zone: 'All',
            location: 'All',
            channel: 'All',
            platform: 'All',
            xAxis: 'Retailer Name',
        };

        const pKpis = await getPrimaryKpis(pParams);
        console.log("Primary KPIs:", pKpis);

        const pMOM = await getPrimaryMOM(pParams, 'MRP');
        console.log("Primary MOM length:", pMOM.length, "Sample:", pMOM[0]);

        const pQuarter = await getPrimaryQuarterly(pParams, 'MRP');
        console.log("Primary Quarterly length:", pQuarter.length, "Sample:", pQuarter[0]);

        const pPivot = await getPrimaryPivotTable(pParams, 'Retailer Name', 'MRP');
        console.log("Primary Pivot table structure - months:", pPivot.months, "allMonths:", pPivot.allMonths, "rows count:", pPivot.data.length);
        if (pPivot.data.length > 0) {
            console.log("Sample pivot row:", pPivot.data[0]);
        }

        console.log("\n=== Testing Secondary Sales Service ===");
        const sDates = await getSecondaryLatestDate();
        console.log("Secondary dates:", sDates);

        const sParams = {
            startDate: sDates.defaultStartDate,
            endDate: sDates.defaultEndDate,
            seller: 'All',
            platformName: 'All',
            brand: 'All',
            subBrand: 'All',
            sku: 'All',
            sapCode: 'All',
            fiscalYear: 'All',
            quarter: 'All',
        };

        const sSellerWise = await getSecondarySellerWise(sParams, 'MRP');
        console.log("Secondary Seller Wise total:", sSellerWise.total, "items count:", sSellerWise.items.length);
        if (sSellerWise.items.length > 0) {
            console.log("Sample Seller Wise item:", sSellerWise.items[0]);
        }

        const sQuarterWise = await getSecondaryQuarterWise(sParams, 'MRP');
        console.log("Secondary Quarter Wise total:", sQuarterWise.total, "items count:", sQuarterWise.items.length);
        if (sQuarterWise.items.length > 0) {
            console.log("Sample Quarter Wise item:", sQuarterWise.items[0]);
        }

        const sTopBrands = await getSecondaryTopBrands(sParams, 'MRP');
        console.log("Secondary Top Brands total:", sTopBrands.total, "items count:", sTopBrands.items.length);
        if (sTopBrands.items.length > 0) {
            console.log("Sample Top Brand:", sTopBrands.items[0]);
        }

        const sTimeline = await getSecondarySalesTimeline(sParams, 'MRP');
        console.log("Secondary Timeline length:", sTimeline.length);
        if (sTimeline.length > 0) {
            console.log("Sample timeline item:", sTimeline[0]);
        }

    } catch (e) {
        console.error("API test failed:", e);
    }
}

testAPIs();
