import dotenv from 'dotenv';
dotenv.config();

import { getMarketShare, getMarketShareByMonth, getMarketShareByBrand, getMarketShareTimeSeries } from './src/services/marketShareHelper.js';
import { getSkuMetrics } from './src/services/skuMetricsService.js';
import dayjs from 'dayjs';

async function verify() {
    const start = dayjs('2026-02-01');
    const end = dayjs('2026-02-28');

    console.log('--- Testing getMarketShare ---');
    try {
        const msAll = await getMarketShare(start, end, 'All', 'All');
        console.log('MS All:', msAll);

        const msChoco = await getMarketShare(start, end, 'Blinkit', 'Chocolates');
        console.log('MS Blinkit Chocolates:', msChoco);

        console.log('--- Testing getMarketShareByBrand ---');
        const msBrands = await getMarketShareByBrand(start, end, 'All', 'All');
        console.log('MS Brands (top 5):', Array.from(msBrands.entries()).slice(0, 5));

        console.log('--- Testing getSkuMetrics for Market Share ---');
        const skuMs = await getSkuMetrics('Market Share', {
            dateFrom: '2026-02-01',
            dateTo: '2026-02-28',
            platform: 'Blinkit'
        });
        console.log('SKU MS (Blinkit, first 2 SKUs):', JSON.stringify(skuMs.slice(0, 2), null, 2));
    } catch (e) {
        console.error('Verification failed:', e);
    }

    process.exit(0);
}

verify().catch(err => {
    console.error(err);
    process.exit(1);
});
