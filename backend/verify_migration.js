import 'dotenv/config';
import inventoryAnalysisService from './src/services/inventoryAnalysisService.js';
import { connectClickHouse } from './src/config/clickhouse.js';

async function testService() {
    try {
        console.log('--- Testing ClickHouse Migration ---');
        const connected = await connectClickHouse();
        if (!connected) return;

        console.log('\n1. Testing getPlatforms...');
        const platforms = await inventoryAnalysisService.getPlatforms();
        console.log('Platforms:', platforms.slice(0, 5), 'Total:', platforms.length);

        console.log('\n2. Testing getInventoryOverview...');
        const overview = await inventoryAnalysisService.getInventoryOverview({
            platform: 'All',
            brand: 'All',
            location: 'All'
        });
        console.log('Metrics (DOH):', overview.metrics.doh.value);
        console.log('Metrics (DRR):', overview.metrics.drr.value);
        console.log('Metrics (Boxes):', overview.metrics.totalBoxesRequired.value);
        console.log('Date Range:', overview.dateRange);

        console.log('\n3. Testing getInventoryMatrix...');
        const matrix = await inventoryAnalysisService.getInventoryMatrix({
            platform: 'All',
            brand: 'All'
        });
        console.log('Matrix Data (first 2):', matrix.data.slice(0, 2));

        console.log('\n4. Testing getCitySkuMatrix...');
        const citySku = await inventoryAnalysisService.getCitySkuMatrix({
            platform: 'All',
            brand: 'All'
        });
        console.log('City-SKU Data (first 2):', citySku.data.slice(0, 2));

        console.log('\n✅ Migration Verification Complete');
    } catch (err) {
        console.error('❌ Verification failed:', err);
    }
}

testService();
