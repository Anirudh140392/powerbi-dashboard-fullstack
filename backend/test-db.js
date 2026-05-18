const { ClickHouse } = require('clickhouse');
require('dotenv').config();

const clickhouse = new ClickHouse({
    url: process.env.CLICKHOUSE_URL,
    port: 8123,
    debug: false,
    basicAuth: {
        username: process.env.CLICKHOUSE_USER,
        password: process.env.CLICKHOUSE_PASSWORD,
    },
    isUseGzip: false,
    trimQuery: false,
    usePost: true,
    format: "json",
    config: {
        database: process.env.CLICKHOUSE_DB,
    },
});

async function run() {
    const q = `SELECT Brand, AVG(if(CASE WHEN delivery_date IS NULL OR delivery_date = '' OR delivery_date = '0' THEN NULL ELSE CASE WHEN dateDiff('day', DATE, parseDateTimeBestEffortOrNull(concat(delivery_date, ' ', toString(toYear(DATE))))) < 0 THEN 0 WHEN dateDiff('day', DATE, parseDateTimeBestEffortOrNull(concat(delivery_date, ' ', toString(toYear(DATE))))) > 30 THEN NULL ELSE dateDiff('day', DATE, parseDateTimeBestEffortOrNull(concat(delivery_date, ' ', toString(toYear(DATE))))) END END IS NOT NULL, toFloat64OrNull(toString(CASE WHEN delivery_date IS NULL OR delivery_date = '' OR delivery_date = '0' THEN NULL ELSE CASE WHEN dateDiff('day', DATE, parseDateTimeBestEffortOrNull(concat(delivery_date, ' ', toString(toYear(DATE))))) < 0 THEN 0 WHEN dateDiff('day', DATE, parseDateTimeBestEffortOrNull(concat(delivery_date, ' ', toString(toYear(DATE))))) > 30 THEN NULL ELSE dateDiff('day', DATE, parseDateTimeBestEffortOrNull(concat(delivery_date, ' ', toString(toYear(DATE))))) END END)), NULL)) as avg_delivery_days FROM rb_pdp_olap WHERE Platform='Flipkart' AND flag=1 GROUP BY Brand limit 10`;
    clickhouse.query(q).exec((err, rows) => {
        if (err) console.error(err);
        else console.log(rows);
    });
}
run();
