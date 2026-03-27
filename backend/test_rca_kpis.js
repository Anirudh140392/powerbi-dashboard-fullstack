// Quick test for /api/rca-tree-kpis endpoint
// Tests directly against the backend without JWT (bypasses auth)

import watchTowerService from './src/services/watchTowerService.js';

async function testDirectly() {
    console.log('=== Testing getEcomOfftake directly (bypassing HTTP) ===\n');
    try {
        const result = await watchTowerService.getEcomOfftake({
            platform: 'Amazon',
            startDate: '2026-03-12',
            endDate: '2026-03-27',
            compareStartDate: '2026-02-24',
            compareEndDate: '2026-03-11'
        });

        console.log('✅ SUCCESS! Data returned:\n');
        console.log('  Offtake Current:', result.currFormatted);
        console.log('  Offtake Previous:', result.prevFormatted);
        console.log('  Offtake Variance:', result.varianceStr);
        console.log('  ');
        console.log('  GVs Current:', result.currGvsFormatted);
        console.log('  GVs Previous:', result.prevGvsFormatted);
        console.log('  GVs Variance:', result.gvsVarianceStr);
        console.log('  ');
        console.log('  CVR Current:', result.currCvrFormatted);
        console.log('  CVR Previous:', result.prevCvrFormatted);
        console.log('  CVR Variance:', result.cvrVarianceStr);
        console.log('  ');
        console.log('  ASP Current:', result.currAspFormatted);
        console.log('  ASP Previous:', result.prevAspFormatted);
        console.log('  ASP Variance:', result.aspVarianceStr);
        console.log('  ');
        console.log('  SOV Current:', result.currSovFormatted);
        console.log('  Category Share:', result.currCatShareFormatted);
        console.log('  ');
        console.log('  Brands Count:', result.brandMetrics?.length);
        if (result.brandMetrics?.length > 0) {
            console.log('  Top Brand:', result.brandMetrics[0].brand, '- ₹', result.brandMetrics[0].rawOfftake?.toFixed(2));
        }
    } catch (err) {
        console.error('❌ FAILED:', err.message);
        console.error(err.stack);
    }
    process.exit(0);
}

testDirectly();
