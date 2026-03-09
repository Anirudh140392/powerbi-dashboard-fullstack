import performanceMarketingService from '../src/services/performanceMarketingService.js';

async function verify() {
    try {
        console.log("--- 1. Testing getCategories() ---");
        const cats = await performanceMarketingService.getCategories();
        console.log("Categories:", cats.slice(0, 5));

        console.log("\n--- 2. Testing getPlatforms() ---");
        const platforms = await performanceMarketingService.getPlatforms();
        console.log("Platforms:", platforms);

        console.log("\n--- 3. Testing getBrands(All) ---");
        const brands = await performanceMarketingService.getBrands('All');
        console.log("Brands (Top 5):", brands.slice(0, 5));

        console.log("\n--- 4. Testing getKeywordAnalysis() ---");
        const analysis = await performanceMarketingService.getKeywordAnalysis({ platform: 'All', brand: 'All', zone: 'All' });
        console.log("Analysis Keyword Count:", analysis.length);

        console.log("\n--- 5. Testing getKpisOverview() ---");
        const kpis = await performanceMarketingService.getKpisOverview({ platform: 'All', brand: 'All', zone: 'All' });
        console.log("KPIs Overview Keys:", Object.keys(kpis));
        console.log("KPI Cards:", kpis.kpi_cards);

        console.log("\n--- 6. Testing getFormatPerformance() ---");
        const formats = await performanceMarketingService.getFormatPerformance({ platform: 'All', brand: 'All', zone: 'All' });
        console.log("Format Performance (Rows):", formats.length);

        console.log("\n--- Verification Complete ---");
        process.exit(0);
    } catch (err) {
        console.error("Verification failed:", err);
        process.exit(1);
    }
}

verify();
