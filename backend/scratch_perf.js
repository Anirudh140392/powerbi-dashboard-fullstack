process.env.CLICKHOUSE_DB = 'cheffin';

async function main() {
    try {
        console.log("Setting CLICKHOUSE_DB to cheffin");
        
        // Dynamically import to ensure process.env.CLICKHOUSE_DB is set first
        const { queryClickHouse } = await import('./src/config/clickhouse.js');
        const { default: visibilityService } = await import('./src/services/visibilityService.js');

        console.log("Current DB:", process.env.CLICKHOUSE_DB);
        
        const filters = {
            viewMode: 'keyword',
            platform: 'All',
            brand: 'All',
            location: 'All',
            keywordType: 'All',
            keywordTypeFilter: 'all',
            keyword: 'All',
            ownBrandsOnly: false,
            startDate: '2026-05-27',
            endDate: '2026-05-27',
            category: 'All',
            channel: 'All',
            sku: 'All'
        };

        const res = await visibilityService.getSearchTermsPerformance(filters);
        console.log("Performance Result Count:", res.items ? res.items.length : 0);
        if (res.items && res.items.length > 0) {
            console.log("Sample items:", res.items.slice(0, 5));
        } else {
            console.log("No items returned!");
        }

    } catch (e) {
        console.error("Error running test:", e);
    }
    process.exit(0);
}

main();
