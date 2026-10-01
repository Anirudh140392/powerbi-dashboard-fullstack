import { ContentAnalysisPlatformsController } from './src/controllers/contentAnalysisController.js';
import { setCurrentDbName } from './src/utils/RequestContext.js';
async function test() {
  const req = { query: { channel: 'quickcomm' }, user: { company_id: 'prestige' } };
  const res = { json: (data) => console.log('Response:', data), status: (code) => ({ json: (err) => console.log('Error', code, err) }) };
  setCurrentDbName('prestige');
  await ContentAnalysisPlatformsController(req, res);
}
test();
