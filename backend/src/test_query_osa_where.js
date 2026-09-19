import { buildAvailabilityWhereClause, queryClickHouse } from './services/availabilityService.js';
import dotenv from 'dotenv';
import dayjs from 'dayjs';

dotenv.config({ path: './.env' });

async function run() {
    try {
        console.log('Generating where clause for All resellers:');
        const filtersAll = {
            platform: 'amazon',
            brand: 'All',
            location: 'All',
            category: 'All',
            sku: 'All',
            ownBrandsOnly: 'true',
            startDate: '2026-06-18',
            endDate: '2026-06-18',
            resellerName: 'All'
        };
        const whereClauseAll = await buildAvailabilityWhereClause(filtersAll);
        console.log('WHERE ALL:', whereClauseAll);

        const queryAll = `
            SELECT 
                SUM(toFloat64OrZero(toString(neno_osa))) as total_neno,
                SUM(toFloat64OrZero(toString(deno_osa))) as total_deno,
                COUNT(DISTINCT Web_Pid) as assortment_count
            FROM rb_pdp_olap
            WHERE ${whereClauseAll}
        `;
        const resAll = await queryClickHouse(queryAll);
        console.log('RESULT ALL:', JSON.stringify(resAll, null, 2));

        console.log('\nGenerating where clause for buy more:');
        const filtersBuyMore = {
            platform: 'amazon',
            brand: 'All',
            location: 'All',
            category: 'All',
            sku: 'All',
            ownBrandsOnly: 'true',
            startDate: '2026-06-18',
            endDate: '2026-06-18',
            resellerName: 'buy more'
        };
        const whereClauseBuyMore = await buildAvailabilityWhereClause(filtersBuyMore);
        console.log('WHERE BUY MORE:', whereClauseBuyMore);

        const queryBuyMore = `
            SELECT 
                SUM(toFloat64OrZero(toString(neno_osa))) as total_neno,
                SUM(toFloat64OrZero(toString(deno_osa))) as total_deno,
                COUNT(DISTINCT Web_Pid) as assortment_count
            FROM rb_pdp_olap
            WHERE ${whereClauseBuyMore}
        `;
        const resBuyMore = await queryClickHouse(queryBuyMore);
        console.log('RESULT BUY MORE:', JSON.stringify(resBuyMore, null, 2));

    } catch (e) {
        console.error(e);
    }
}
run();
