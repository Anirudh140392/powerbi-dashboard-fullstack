import { getPricingKpis, getDimensionOverview } from './src/services/pricingAnalysisService.js';
import dayjs from 'dayjs';
import dotenv from 'dotenv';
dotenv.config();

async function verify() {
    try {
        const filters = {
            platform: 'Blinkit',
            startDate: '2025-11-01',
            endDate: '2025-11-30',
            brand: 'All',
            category: 'All',
            location: 'All'
        };

        console.log('--- FETCHING KPIS (Pricing Overview) ---');
        const kpisResult = await getPricingKpis(filters);
        if (!kpisResult.success || !kpisResult.data) {
            console.error('KPIs failed or empty:', kpisResult);
            return;
        }
        
        const kpisASP = kpisResult.data.asp.value;
        const kpisDiscount = kpisResult.data.discount.value;
        const kpisPricePerUnit = kpisResult.data.pricePerUnit.value;
        
        console.log('KPIs ASP:', kpisASP);
        console.log('KPIs Discount:', kpisDiscount);
        console.log('KPIs PricePerUnit:', kpisPricePerUnit);

        console.log('\n--- FETCHING DIMENSION OVERVIEW (Category Overview) ---');
        const dimResult = await getDimensionOverview({ ...filters, dimension: 'platform' });
        if (!dimResult.success || !dimResult.data) {
            console.error('Dimension failed or empty:', dimResult);
            return;
        }

        const blinkitRow = dimResult.data.find(r => r.name === 'Blinkit');
        if (!blinkitRow) {
            console.error('Blinkit row not found in dimension overview. Available:', dimResult.data.map(r => r.name));
            return;
        }

        const dimASP = blinkitRow.data.asp.value;
        const dimDiscount = blinkitRow.data.discount.value;
        const dimPricePerUnit = blinkitRow.data.pricePerUnit.value;

        console.log('Dimension ASP:', dimASP);
        console.log('Dimension Discount:', dimDiscount);
        console.log('Dimension PricePerUnit:', dimPricePerUnit);
        
        console.log('\n--- COMPARISON ---');
        const isASPMismatch = Math.abs(kpisASP - dimASP) > 0.01;
        const isDiscountMismatch = Math.abs(kpisDiscount - dimDiscount) > 0.01;
        const isPPUMismatch = Math.abs(kpisPricePerUnit - dimPricePerUnit) > 0.01;

        if (isASPMismatch) console.log(`[!] ASP Mismatch: ${kpisASP} vs ${dimASP}`);
        else console.log(`[+] ASP Matches: ${kpisASP}`);

        if (isDiscountMismatch) console.log(`[!] Discount Mismatch: ${kpisDiscount} vs ${dimDiscount}`);
        else console.log(`[+] Discount Matches: ${kpisDiscount}`);

        if (isPPUMismatch) console.log(`[!] PricePerUnit Mismatch: ${kpisPricePerUnit} vs ${dimPricePerUnit}`);
        else console.log(`[+] PricePerUnit Matches: ${kpisPricePerUnit}`);

    } catch (e) {
        console.error('Error in verify:', e);
    }
}

verify().catch(console.error).finally(() => process.exit());
