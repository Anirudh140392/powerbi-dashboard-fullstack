import { getContentAnalysisPlatforms } from './src/services/contentAnalysisService.js';
import { setCurrentDbName } from './src/utils/requestContext.js';
async function test() {
  try {
    setCurrentDbName('prestige');
    const p1 = await getContentAnalysisPlatforms('EComm');
    console.log('EComm:', p1);
    const p2 = await getContentAnalysisPlatforms('QComm');
    console.log('QComm:', p2);
  } catch (e) { console.error(e); }
}
test();
