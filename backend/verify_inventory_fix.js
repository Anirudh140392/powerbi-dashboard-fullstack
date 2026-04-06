import inventoryAnalysisService from './src/services/inventoryAnalysisService.js';
import dayjs from 'dayjs';

async function verify() {
    console.log('--- Verifying Inventory Overview Fixes ---');
    
    const filters = {
        startDate: '2026-02-01',
        endDate: '2026-03-01',
        platform: 'Blinkit'
    };

    try {
        console.log('1. Checking Matrix for Brands and Negative Values...');
        const matrix = await inventoryAnalysisService.getInventoryMatrix(filters);
        
        const brands = [...new Set(matrix.data.map(r => r.brand))];
        console.log('Brands found in matrix:', brands);
        
        const negativeValues = matrix.data.filter(r => r.inventory < 0);
        console.log('Negative inventory count:', negativeValues.length);
        
        if (negativeValues.length > 0) {
            console.error('FAIL: Found negative inventory values!', negativeValues.slice(0, 5));
        }

        console.log('\n2. Checking Overview for Negative Values...');
        const overview = await inventoryAnalysisService.getInventoryOverview(filters);
        console.log('DOH Value:', overview.metrics.doh.value);
        console.log('DRR Value:', overview.metrics.drr.value);
        
        const sparklineNegatives = overview.metrics.doh.sparkline.filter(v => v < 0);
        console.log('Negative sparkline values count:', sparklineNegatives.length);

        console.log('\n3. Checking Brands filter metadata...');
        const availBrands = await inventoryAnalysisService.getBrands('Blinkit');
        console.log('Available brands for Blinkit (should be own only):', availBrands);

        // Check for common competitor brands
        const competitors = ['5 Star', 'Amul', 'Cadbury', 'Ferrero'];
        const foundCompetitors = availBrands.filter(b => competitors.some(c => b.includes(c)));
        if (foundCompetitors.length > 0) {
            console.error('FAIL: Found competitor brands:', foundCompetitors);
        } else {
            console.log('SUCCESS: No obvious competitor brands found in metadata.');
        }

        console.log('\n--- Verification Complete ---');
        process.exit(0);
    } catch (err) {
        console.error('Verification failed:', err);
        process.exit(1);
    }
}

verify();
