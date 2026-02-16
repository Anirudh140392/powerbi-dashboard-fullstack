
import { createClient } from '@clickhouse/client';
import dotenv from 'dotenv';
dotenv.config();

const clickhouse = createClient({
    url: process.env.CLICKHOUSE_URL || 'http://13.200.55.131:8123',
    username: process.env.CLICKHOUSE_USER || 'readonly_user',
    password: process.env.CLICKHOUSE_PASSWORD || 'Readonly@123',
    database: process.env.CLICKHOUSE_DB || 'colpal',
    request_timeout: 60000,
});

async function findOverlap() {
    console.log('Finding data overlap...');
    try {
        // Find a recent date with data
        const query = `
            SELECT 
                t.DATE as Current_Date,
                date_add(year, -1, t.DATE) as Past_Date
            FROM rb_pdp_olap t
            WHERE toYear(t.DATE) >= 2024
            LIMIT 1
        `;

        const result = await clickhouse.query({
            query: query,
            format: 'JSONEachRow',
        });
        const data = await result.json();
        if (data.length > 0) {
            console.log('Overlap Candidate:', JSON.stringify(data[0], null, 2));
            // Now verify using this date
            await verifyForDate(data[0].Current_Date);
        } else {
            console.log('No recent data found to test.');
        }

    } catch (err) {
        console.error('Failure:', err.message);
    }
}

async function verifyForDate(date) {
    console.log(`Verifying for date: ${date}`);
    const query = `
        WITH daily_agg AS(
            SELECT 
                toDate(DATE) as DATE, Platform, Brand, Location as City, Category as Format, Product,
                SUM(toFloat64OrZero(Sales)) as daily_sales
            FROM rb_pdp_olap
            WHERE toDate(DATE) = '${date}' OR toDate(DATE) = date_add(year, -1, toDate('${date}'))
            GROUP BY DATE, Platform, Brand, City, Format, Product
        ),
        running_metrics AS(
            SELECT
                *,
                SUM(daily_sales) OVER(PARTITION BY Platform, Brand, City, Format, Product, toStartOfMonth(DATE) ORDER BY DATE) as MTD_Sales
            FROM daily_agg
        )
        SELECT
            t.DATE as DATE, t.Product,
            round(t.daily_sales, 2) as Sales,
            round(ly.daily_sales, 2) as LAST_YEAR_SALES,
            round(ly.MTD_Sales, 2) as LYMTD
        FROM running_metrics t
        LEFT JOIN running_metrics ly ON
            t.Platform = ly.Platform AND t.Brand = ly.Brand AND t.City = ly.City AND t.Format = ly.Format AND t.Product = ly.Product
            AND t.DATE = date_add(year, 1, ly.DATE)
        WHERE t.DATE = '${date}'
        AND ly.daily_sales > 0
        LIMIT 1
    `;

    try {
        const result = await clickhouse.query({ query, format: 'JSONEachRow' });
        const data = await result.json();
        console.log('Verification Result:', JSON.stringify(data, null, 2));
    } catch (e) { console.error(e.message); }
}

findOverlap().then(() => console.log('Done'));
