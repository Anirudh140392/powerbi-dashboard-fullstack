import performanceMarketingService from './src/services/performanceMarketingService.js';

async function verify() {
    console.log("Testing getCampaignQuadrants...");
    const quadrants = await performanceMarketingService.getCampaignQuadrants({});
    console.log(quadrants);
}

verify().then(() => process.exit(0)).catch(console.error);
