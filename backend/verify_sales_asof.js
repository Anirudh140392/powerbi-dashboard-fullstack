
import { createClient } from '@clickhouse/client';
import dayjs from 'dayjs';
import dotenv from 'dotenv';
dotenv.config();

const clickhouse = createClient({
    url: process.env.CLICKHOUSE_URL || 'http://13.200.55.131:8123',
    username: process.env.CLICKHOUSE_USER || 'readonly_user',
    password: process.env.CLICKHOUSE_PASSWORD || 'Readonly@123',
    database: process.env.CLICKHOUSE_DB || 'colpal',
    request_timeout: 60000,
});

async function verifySalesASOF() {
    console.log('Starting Sales Data verification (ASOF JOIN)...');
    try {
        const endDate = dayjs().format('YYYY-MM-DD');
        const startDate = dayjs().subtract(7, 'day').format('YYYY-MM-DD');
        const widerStartDate = dayjs(startDate).subtract(13, 'month').format('YYYY-MM-DD');

        // Simplified query to test ASOF logic
        const query = `
            WITH daily_agg AS(
                SELECT 
                    toDate(DATE) as DATE, Platform, Brand, Location as City, Category as Format, Product,
                    SUM(toFloat64OrZero(Sales)) as daily_sales
                FROM rb_pdp_olap
                WHERE toDate(DATE) BETWEEN '${widerStartDate}' AND '${endDate}'
                AND Platform = 'Zepto'
                GROUP BY DATE, Platform, Brand, City, Format, Product
            ),
            running_metrics AS(
                SELECT
                    *,
                    toDate(date_add(year, -1, DATE)) as PrevYearDate,
                    SUM(daily_sales) OVER(PARTITION BY Platform, Brand, City, Format, Product, toStartOfMonth(DATE) ORDER BY DATE) as MTD_Sales
                FROM daily_agg
            )
            SELECT
                t.DATE as DATE, t.Product,
                round(t.daily_sales, 2) as Sales,
                round(ly.daily_sales, 2) as REF_LY_DAILY,
                round(if(toStartOfMonth(ly.DATE) = toStartOfMonth(t.PrevYearDate), ly.MTD_Sales, 0), 2) as LYMTD,
                ly.DATE as MATCHED_LY_DATE,
                t.PrevYearDate as TARGET_LY_DATE
            FROM running_metrics t
            LEFT ASOF JOIN running_metrics ly ON
                t.Platform = ly.Platform AND t.Brand = ly.Brand AND t.City = ly.City AND t.Format = ly.Format AND t.Product = ly.Product
                AND t.PrevYearDate >= ly.DATE
            WHERE t.DATE BETWEEN '${startDate}' AND '${endDate}'
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
        }

    } catch (err) {
        console.error('--- FAILURE ---');
        console.error(err.message);
    }
}

verifySalesASOF().then(() => console.log('Done'));
