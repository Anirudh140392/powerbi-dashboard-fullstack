import performanceMarketingService from './src/services/performanceMarketingService.js';

async function verify() {
    const filters = { startDate: '2026-02-06', endDate: '2026-02-20' };
    const quadrants = await performanceMarketingService.getCampaignQuadrants(filters);
    console.log(JSON.stringify(quadrants));
}

verify().then(() => process.exit(0)).catch(console.error);
