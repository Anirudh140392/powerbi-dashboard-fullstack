import 'dotenv/config';
import performanceMarketingService from './src/services/performanceMarketingService.js';
async function test() {
  try {
    const data = await performanceMarketingService.getKeywordAnalysis({ platform: 'All' });
    console.log(JSON.stringify(data.slice(0, 2), null, 2));
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
test();
