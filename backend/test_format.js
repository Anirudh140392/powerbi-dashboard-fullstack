import 'dotenv/config';
import performanceMarketingService from './src/services/performanceMarketingService.js';
async function test() {
  try {
    const data = await performanceMarketingService.getFormatPerformance({ platform: 'All' });
    console.log("Returned sample:", data[0]);
    console.log("Keys:", Object.keys(data[0]));
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
test();
