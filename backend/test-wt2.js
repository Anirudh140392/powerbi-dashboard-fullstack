import pkg from './src/services/watchTowerService.js';
const { getOverview } = pkg;
import dayjs from 'dayjs';
import clickhouse from './src/config/clickhouse.js';

async function run() {
    const filters = {
        startDate: '2026-02-01',
        endDate: '2026-02-28',
        qCompareStartDate: '2026-01-04',
        qCompareEndDate: '2026-01-31',
        channel: 'All',
        platform: ['Blinkit'],
        category: 'All',
        location: 'All'
    };

    // The queryClickHouse might be default export or named export depending on clickhouse.js
    let originalQuery;
    if (clickhouse.queryClickHouse) {
        originalQuery = clickhouse.queryClickHouse;
        clickhouse.queryClickHouse = async (query) => {
            if (!query.includes('FROM rca_') && !query.includes('rca_brand_dim')) {
                console.log('--- SQL QUERY ---');
                console.log(query.trim());
                console.log('-----------------');
            }
            return originalQuery(query);
        };
    } else {
        originalQuery = clickhouse.default.queryClickHouse;
        clickhouse.default.queryClickHouse = async (query) => {
            if (!query.includes('FROM rca_') && !query.includes('rca_brand_dim')) {
                console.log('--- SQL QUERY ---');
                console.log(query.trim());
                console.log('-----------------');
            }
            return originalQuery(query);
        };
    }

    console.log("Testing getOverview:");
    try {
        const result = await getOverview(filters);
        console.log("Top Metrics Labels:");
        result.topMetrics.forEach(m => console.log(m.name, m.label));
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

run();
