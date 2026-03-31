import performanceMarketingService from './src/services/performanceMarketingService.js';

async function verify() {
    console.log("Testing getCampaignQuadrants...");
    const filters = { startDate: '2026-02-06', endDate: '2026-02-12' };
    console.log("Filters:", filters);
    const quadrants = await performanceMarketingService.getCampaignQuadrants(filters);
    console.log("Result:", quadrants);
}

verify().then(() => process.exit(0)).catch(console.error);
