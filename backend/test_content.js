import { getContentAnalysisPlatforms } from './src/services/contentAnalysisService.js';
import { setCurrentDbName } from './src/utils/RequestContext.js';
async function run() {
  setCurrentDbName('mars');
  const plats = await getContentAnalysisPlatforms('QComm');
  console.log("QComm:", plats);
  const platsE = await getContentAnalysisPlatforms('EComm');
  console.log("EComm:", platsE);
}
run().catch(console.error);
