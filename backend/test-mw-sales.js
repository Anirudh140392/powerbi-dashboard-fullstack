require('dotenv').config();
const { ClickHouse } = require('clickhouse');

const clickhouse = new ClickHouse({
    url: process.env.CLICKHOUSE_URL || 'http://13.201.214.2',
    port: process.env.CLICKHOUSE_PORT || 8123,
    debug: false,
    basicAuth: {
        username: process.env.CLICKHOUSE_USER || 'default',
        password: process.env.CLICKHOUSE_PASSWORD || 'Olap@123',
    },
});

async function testQuery() {
    const query = `
        SELECT platform,
               SUM(toFloat64OrZero(toString(sales))) as mw_sales
        FROM rb_ms_olap
        WHERE toDate(created_on) BETWEEN '2024-01-01' AND '2024-12-31'
        AND platform = 'Blinkit'
        AND (
            lower(group_brand) LIKE '%mars%'
            OR lower(group_brand) LIKE '%wrigley%'
            OR lower(group_brand) LIKE '%snickers%'
            OR lower(group_brand) LIKE '%galaxy%'
            OR lower(group_brand) LIKE '%bounty%'
            OR lower(group_brand) LIKE '%twix%'
            OR lower(group_brand) LIKE '%m&m%'
            OR lower(group_brand) LIKE '%orbit%'
            OR lower(group_brand) LIKE '%skittles%'
            OR lower(group_brand) LIKE '%boomer%'
            OR lower(group_brand) LIKE '%doublemint%'
        )
        GROUP BY platform
    `;

    try {
        const result = await clickhouse.query(query).toPromise();
        console.log('Results:', result);
    } catch (e) {
        console.error('Error:', e);
    }
}

testQuery();
