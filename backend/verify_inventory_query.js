
import { createClient } from '@clickhouse/client';
import dayjs from 'dayjs';
import dotenv from 'dotenv';
dotenv.config();

const clickhouse = createClient({
    url: process.env.CLICKHOUSE_URL || 'http://13.200.55.131:8123',
    username: process.env.CLICKHOUSE_USER || 'readonly_user',
    password: process.env.CLICKHOUSE_PASSWORD || 'Readonly@123',
    database: process.env.CLICKHOUSE_DB || 'colpal',
    request_timeout: 30000,
});

async function verifyInventoryQuery() {
    console.log('Starting Inventory Analysis verification...');
    try {
        const endDate = dayjs().format('YYYY-MM-DD');
        const startDate = dayjs().subtract(7, 'day').format('YYYY-MM-DD');

        const query = `
            SELECT
                DATE as Date, Platform, Brand, Location as City, Category as Format, Product,
                round(argMax(toFloat64OrZero(Inventory), DATE), 2) as Current_Inventory,
                round(SUM(ifNull(Qty_Sold, 0)) / 30, 2) as DRR,
                round(if (DRR > 0, Current_Inventory / DRR, 0), 2) as DOH
            FROM rb_pdp_olap
            WHERE toDate(DATE) BETWEEN '${startDate}' AND '${endDate}'
            GROUP BY DATE, Platform, Brand, Location, Category, Product
            ORDER BY DATE DESC
            LIMIT 5
        `;

        console.log('Sending query...');
        const result = await clickhouse.query({
            query: query,
            format: 'JSONEachRow',
        });
        const data = await result.json();
        console.log('--- SUCCESS ---');
        console.log('Returned ' + data.length + ' rows.');
        if (data.length > 0) {
            console.log(JSON.stringify(data[0], null, 2));
            const keys = Object.keys(data[0]);
            if (!keys.includes('Req_PO_Quantity') && !keys.includes('Req_Boxes')) {
                console.log('Verification PASSED: Columns removed.');
            } else {
                console.log('Verification FAILED: Columns still present.');
            }
        } else {
            console.log('No data returned, but query is valid.');
        }

    } catch (err) {
        console.error('--- FAILURE ---');
        console.error(err.message);
    }
}

verifyInventoryQuery();
