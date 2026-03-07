import { queryClickHouse } from './src/config/clickhouse.js';
import MapIntellectService from './src/services/mapIntellectService.js';
async function test() {
  console.time('Full Execution');
  try {
    const filters = { platform: 'Blinkit', startDate: '2026-02-01', endDate: '2026-02-28', months: 1, brand: 'All', category: 'All' };
    console.time('getMapIntellectData');
    const result = await MapIntellectService.getMapIntellectData(filters);
    console.timeEnd('getMapIntellectData');
    console.log(result.cities.slice(0, 5));
  } catch (err) {
    console.error(err);
  }
  console.timeEnd('Full Execution');
  process.exit();
}
test();
