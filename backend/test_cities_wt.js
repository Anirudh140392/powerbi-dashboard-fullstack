import { queryClickHouse } from './src/config/clickhouse.js';
import watchTowerService from './src/services/watchTowerService.js';

async function run() {
    // Get unique locations in rb_pdp_olap
    const cities = await queryClickHouse(`SELECT DISTINCT Location FROM rb_pdp_olap LIMIT 20`);
    console.log('Available Locations:', cities.map(c => c.Location));

    // Get max date in rb_pdp_olap
    const dates = await queryClickHouse(`SELECT MAX(DATE) as max_date, MIN(DATE) as min_date FROM rb_pdp_olap`);
    console.log('Available Date Range:', dates);

    // Call getCityOverview with correct dates
    const maxDate = dates[0].max_date;
    const filters = {
        startDate: '2020-01-01', // wide range
        endDate: maxDate,
        compareStartDate: '2020-01-01',
        compareEndDate: maxDate,
        channel: 'QuickComm',
        filterLogic: 'OR'
    };
    const cityRes = await watchTowerService.getCityOverview(filters);
    console.log('City Overview Results Count:', cityRes.length);
    if (cityRes.length > 0) {
        cityRes.forEach(r => {
            const msCol = r.columns?.find(c => c.title === 'Market Share');
            console.log(`City: ${r.label} | Market Share: ${msCol?.value} | Change: ${msCol?.change?.text}`);
        });
    }

    process.exit(0);
}
run().catch(e => {
    console.error(e);
    process.exit(1);
});
