import dotenv from 'dotenv';
dotenv.config();

const runTest = async () => {
    try {
        const { default: sequelize } = await import('./src/config/db.js');
        const { default: watchTowerService } = await import('./src/services/watchTowerService.js');
        console.log("Database connected.");

        const filters = {
            startDate: '2026-03-01',
            endDate: '2026-03-18', // user testing period for 7.5%
            brand: 'All',
            platform: 'All',
            location: 'All',
            category: 'All'
        };

        console.log("Testing Watch Tower Overview SOS...");
        const summary = await watchTowerService.getSummaryMetrics(filters);
        console.log("Watch Tower Overview SOS:", summary?.currentShareOfSearch);

        console.log("\nTesting Platform Overview SOS (Blinkit 03-01 to 03-16)...");
        const filtersBlinkit = {
            startDate: '2026-03-01',
            endDate: '2026-03-16',
            brand: 'All',
            platform: 'Blinkit',
            location: 'All',
            category: 'All'
        };
        const platformTrends = await watchTowerService.getPlatformTrends(filtersBlinkit);
        
        let blinkitSos = 0;
        let blinkitRow = platformTrends.data?.find(p => p.Platform?.toLowerCase() === 'blinkit');
        if (blinkitRow) {
            console.log("Blinkit Row SOS:", blinkitRow.All_Share_Of_Search);
        } else {
            console.log("Blinkit platform row not found in trends.");
        }
        
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
runTest();
