process.env.CLICKHOUSE_DB = 'mars';

async function run() {
    try {
        const { queryClickHouse } = await import('./src/config/clickhouse.js');
        
        console.log("1. Distinct platforms in rb_po_olap:");
        const res1 = await queryClickHouse("SELECT platform, count(*) as cnt FROM rb_po_olap GROUP BY platform");
        console.log(res1);

        console.log("2. Distinct po_status in rb_po_olap:");
        const res2 = await queryClickHouse("SELECT po_status, count(*) as cnt FROM rb_po_olap GROUP BY po_status");
        console.log(res2);

        console.log("3. Distinct platforms & po_status in rb_po_olap:");
        const res3 = await queryClickHouse("SELECT platform, po_status, count(*) as cnt FROM rb_po_olap GROUP BY platform, po_status");
        console.log(res3);

    } catch (err) {
        console.error("Error:", err);
    }
    process.exit(0);
}
run();
