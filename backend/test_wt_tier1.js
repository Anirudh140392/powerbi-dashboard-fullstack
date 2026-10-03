import watchTowerService from './src/services/watchTowerService.js';

const tier1Filters = {
    startDate: '2026-02-01',
    endDate: '2026-03-07',
    compareStartDate: '2025-12-28',
    compareEndDate: '2026-01-31',
    channel: 'QuickComm',
    location: ['Mumbai', 'Delhi'], // All Tier-1
    filterLogic: 'OR'
};

const tier2Filters = {
    startDate: '2026-02-01',
    endDate: '2026-03-07',
    compareStartDate: '2025-12-28',
    compareEndDate: '2026-01-31',
    channel: 'QuickComm',
    location: ['Mumbai', 'Jaipur'], // Contains Jaipur (Tier-2)
    filterLogic: 'OR'
};

async function runTest() {
    console.log('--- TESTING TIER 1 CITIES ONLY ---');
    const res1 = await watchTowerService.getPlatformOverview(tier1Filters);
    const ms1 = res1[0]?.columns?.find(c => c.title === 'Market Share');
    console.log('Tier-1 selection Market Share column output:', JSON.stringify(ms1));

    console.log('\n--- TESTING TIER 2 CITIES (JAIPUR SELECTED) ---');
    const res2 = await watchTowerService.getPlatformOverview(tier2Filters);
    const ms2 = res2[0]?.columns?.find(c => c.title === 'Market Share');
    console.log('Tier-2/3 selection Market Share column output:', JSON.stringify(ms2));

    console.log('\n--- TESTING OTHER BREAKDOWN ENDPOINTS ---');
    const monthRes = await watchTowerService.getMonthOverview(tier2Filters);
    const hasMonthMs = monthRes.some(m => m.columns?.some(c => c.title === 'Market Share' && c.value !== 'N/A'));
    console.log('Month Overview has any non-N/A Market Share with Tier-2 filters:', hasMonthMs);

    const catRes = await watchTowerService.getCategoryOverview(tier2Filters);
    const hasCatMs = catRes.some(c => c.columns?.some(col => col.title === 'Market Share' && col.value !== 'N/A'));
    console.log('Category Overview has any non-N/A Market Share with Tier-2 filters:', hasCatMs);

    const brandRes = await watchTowerService.getBrandsOverview(tier2Filters);
    const hasBrandMs = brandRes.some(b => b.columns?.some(col => col.title === 'Market Share' && col.value !== 'N/A'));
    console.log('Brand Overview has any non-N/A Market Share with Tier-2 filters:', hasBrandMs);

    const skuRes = await watchTowerService.getSkuOverview(tier2Filters);
    const hasSkuMs = skuRes.some(s => s.columns?.some(col => col.title === 'Market Share' && col.value !== 'N/A'));
    console.log('SKU Overview has any non-N/A Market Share with Tier-2 filters:', hasSkuMs);

    const cityRes = await watchTowerService.getCityOverview(tier2Filters);
    // Print city overview columns for Mumbai (Tier-1) vs Jaipur (Tier-2)
    const mumbaiRow = cityRes.find(r => r.label?.toLowerCase() === 'mumbai');
    const jaipurRow = cityRes.find(r => r.label?.toLowerCase() === 'jaipur');
    console.log('City Overview - Mumbai MS:', JSON.stringify(mumbaiRow?.columns?.find(c => c.title === 'Market Share')));
    console.log('City Overview - Jaipur MS:', JSON.stringify(jaipurRow?.columns?.find(c => c.title === 'Market Share')));
    
    process.exit(0);
}

runTest().catch(e => {
    console.error(e);
    process.exit(1);
});
