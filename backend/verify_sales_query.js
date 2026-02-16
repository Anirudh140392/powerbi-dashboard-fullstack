
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

async function verifySalesQuery() {
    console.log('Starting Sales Data verification...');
    try {
        const endDate = dayjs().format('YYYY-MM-DD');
        const startDate = dayjs().subtract(30, 'day').format('YYYY-MM-DD');
        // Fetch wider range for history
        const widerStartDate = dayjs(startDate).subtract(13, 'month').format('YYYY-MM-DD');

        const query = `
            WITH daily_agg AS(
                SELECT 
                    toDate(DATE) as DATE, Platform, Brand, Location as City, Category as Format, Product,
                    SUM(toFloat64OrZero(Sales)) as daily_sales,
                    SUM(assumeNotNull(Qty_Sold)) as daily_orders
                FROM rb_pdp_olap
                WHERE toDate(DATE) BETWEEN '${widerStartDate}' AND '${endDate}'
                GROUP BY DATE, Platform, Brand, City, Format, Product
            ),
            running_metrics AS(
                SELECT
                    *,
                    SUM(daily_sales) OVER(PARTITION BY Platform, Brand, City, Format, Product, toStartOfMonth(DATE) ORDER BY DATE) as MTD_Sales,
                    SUM(daily_sales) OVER(PARTITION BY Platform, Brand, City, Format, Product, toStartOfYear(DATE) ORDER BY DATE) as YTD_Sales
                FROM daily_agg
            )
            SELECT
                t.DATE as DATE, t.Platform, t.Product,
                round(t.daily_sales, 2) as Overall_Sales,
                round(ly.daily_sales, 2) as LAST_YEAR_SALES,
                round(ly.MTD_Sales, 2) as LYMTD
            FROM running_metrics t
            LEFT JOIN running_metrics ly ON
                t.Platform = ly.Platform AND t.Brand = ly.Brand AND t.City = ly.City AND t.Format = ly.Format AND t.Product = ly.Product
                AND t.DATE = date_add(year, 1, ly.DATE)
            WHERE t.DATE BETWEEN '${startDate}' AND '${endDate}'
            ORDER BY t.DATE DESC
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
        } else {
            console.log('No data returned.');
        }

    } catch (err) {
        console.error('--- FAILURE ---');
        console.error(err.message);
    }
}

verifySalesQuery();
