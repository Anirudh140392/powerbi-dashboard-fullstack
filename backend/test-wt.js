import { getSummaryMetrics } from './src/services/watchTowerService.js';
import dayjs from 'dayjs';
import clickhouse from './src/config/clickhouse.js';

async function run() {
    const filters = {
        startDate: dayjs('2026-02-01'),
        endDate: dayjs('2026-02-28'),
        qCompareStartDate: dayjs('2026-01-04'),
        qCompareEndDate: dayjs('2026-01-31'),
        channel: 'All',
        platform: ['Blinkit'],
        category: 'All',
        location: 'All'
    };

    const originalQuery = clickhouse.queryClickHouse;

    clickhouse.queryClickHouse = async (query) => {
        if (!query.includes('FROM rca_') && !query.includes('rca_brand_dim')) {
            console.log('--- SQL QUERY ---');
            console.log(query.trim());
            console.log('-----------------');
        }
        return originalQuery(query);
    };

    console.log("Testing getSummaryMetrics:");
    try {
        const summary = await getSummaryMetrics(filters);
        console.log("Output Summary:");
        console.log(summary);
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

run();
