import { getVisibilityFilterOptions } from './src/controllers/visibilityAnalysisController.js';
import visibilityService from './src/services/visibilityService.js';

async function test() {
    const res = await visibilityService.getVisibilityFilterOptions({
        filterType: 'platforms',
        channel: 'All'
    });
    console.log(res);
}

test().catch(console.error);
