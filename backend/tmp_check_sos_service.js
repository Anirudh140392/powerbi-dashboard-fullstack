import visibilityService from './src/services/visibilityService.js';
import dayjs from 'dayjs';

async function test() {
    try {
        console.log("Testing getVisibilityOverview with default filters...");
        const filters = {
            startDate: dayjs().subtract(7, 'day').format('YYYY-MM-DD'),
            endDate: dayjs().format('YYYY-MM-DD')
        };
        const result = await visibilityService.getVisibilityOverview(filters);
        console.log(JSON.stringify(result, null, 2));

        console.log("Testing with brand='All'...");
        const filtersAll = { ...filters, brand: ['All'] };
        const resultAll = await visibilityService.getVisibilityOverview(filtersAll);
        console.log(JSON.stringify(resultAll, null, 2));

    } catch (err) {
        console.error("Error:", err);
    }
}

test();
