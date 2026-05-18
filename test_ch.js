import { ClickHouse } from 'clickhouse';
const clickhouse = new ClickHouse({
    url: 'http://localhost',
    port: 8123,
    debug: false,
    basicAuth: null,
    isUseGzip: false,
    trimQuery: false,
    usePost: false,
    format: "json",
});

const query = `
    SELECT
        item_name AS skuName,
        SUM(CASE WHEN created_on BETWEEN '2024-04-01' AND '2024-04-26' THEN toFloat64OrZero(toString(sales)) ELSE 0 END) AS curr_sales,
        SUM(CASE WHEN created_on BETWEEN '2024-03-07' AND '2024-03-31' THEN toFloat64OrZero(toString(sales)) ELSE 0 END) AS prev_sales,
        (curr_sales - prev_sales) AS sales_delta
    FROM trailytics_2025.rb_ms_olap
    WHERE (created_on BETWEEN '2024-04-01' AND '2024-04-26' OR created_on BETWEEN '2024-03-07' AND '2024-03-31')
      AND group_brand IS NOT NULL AND group_brand != ''
      AND item_name IS NOT NULL AND item_name != ''
      AND platform IN ('Blinkit')
      AND multiIf(LOWER(location) IN ('gurgaon','gurugram'), 'Gurugram', LOWER(location) IN ('bangalore','bengaluru'), 'Bengaluru', initCap(location)) IN ('Mumbai')
      AND LOWER(category) IN ('chocolates (non gifting)')
      AND flag != 1
    GROUP BY skuName
    HAVING sales_delta > 0
    ORDER BY abs(sales_delta) DESC
    LIMIT 10
`;

clickhouse.query(query).exec(function (err, rows) {
    if (err) console.error(err);
    else console.log(rows);
});
