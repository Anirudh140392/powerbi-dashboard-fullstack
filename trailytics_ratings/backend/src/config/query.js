import clickhouse from './clickhouse.js';

(async () => {
    try {
        const sql = `SELECT company_id, count(*) FROM rb_review_olap GROUP BY company_id`;
        const res = await clickhouse.query({
            query: sql,
            format: 'JSONEachRow'
        });
        const rows = await res.json();
        console.log("Cols:", rows);
    } catch(e) {}
    process.exit(0);
})();
