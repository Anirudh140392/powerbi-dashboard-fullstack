import { getInsightsData } from './src/services/insightsService.js';
import { setCurrentDbName } from './src/utils/queryClickHouse.js';

(async () => {
  try {
    setCurrentDbName('mars');
    const filters = {
      signal: 'Remove Ad Low OSA',
      brand: 'Mars',
      platform: 'All platforms',
      city: 'All cities',
      category: 'All categories',
      datePreset: 'Custom',
      startDate: '2024-01-01',
      endDate: '2024-01-31'
    };
    const res = await getInsightsData(filters);
    console.log(JSON.stringify(res, null, 2));
  } catch (e) {
    console.error(e);
  }
})();
