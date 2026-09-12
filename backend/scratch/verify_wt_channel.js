import watchTowerService from '../src/services/watchTowerService.js';
import clickhouse from '../src/config/clickhouse.js';

async function run() {
    const baseFilters = {
        startDate: '2026-02-01',
        endDate: '2026-02-28',
        category: 'All',
        location: 'All',
        brand: 'All'
    };

    console.log("=================== TESTING WITH CHANNEL: Quick Commerce ===================");
    try {
        const resultQC = await watchTowerService.getPlatformOverview({ ...baseFilters, channel: 'Quick Commerce' });
        console.log("Quick Commerce Platform Overview platforms:", resultQC.map(p => ({
            key: p.key,
            title: p.title,
            metrics: p.columns ? p.columns.map(c => `${c.title}: ${c.value}`) : []
        })));
    } catch (e) {
        console.error("Error during Quick Commerce test:", e);
    }

    console.log("\n=================== TESTING WITH CHANNEL: E-commerce ===================");
    try {
        const resultEC = await watchTowerService.getPlatformOverview({ ...baseFilters, channel: 'E-commerce' });
        console.log("E-commerce Platform Overview platforms:", resultEC.map(p => ({
            key: p.key,
            title: p.title,
            metrics: p.columns ? p.columns.map(c => `${c.title}: ${c.value}`) : []
        })));
    } catch (e) {
        console.error("Error during E-commerce test:", e);
    }

    process.exit(0);
}

run();
