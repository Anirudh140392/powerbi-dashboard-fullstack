const { ClickHouse } = require('clickhouse');
const ch = new ClickHouse({
    url: 'http://localhost',
    port: 8123,
    debug: false,
    basicAuth: null,
    isUseGzip: false,
    format: "json", 
});

const query = async (sql) => {
    return new Promise((resolve, reject) => {
        ch.query(sql).exec((err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

(async () => {
    try {
        console.log("Checking tables...");
        const tables = await query("SHOW TABLES LIKE '%mamaearth%'");
        console.log(tables);
        
        console.log("Checking columns for mamaearth rb_ms_olap...");
        const cols = await query("DESCRIBE mamaearth_rb_ms_olap");
        const deliveryCols = cols.filter(c => c.name.toLowerCase().includes('delivery'));
        console.log("Delivery cols:", deliveryCols);

        if (deliveryCols.length > 0) {
            console.log("Sample delivery data:");
            const data = await query(`SELECT delivery_date, count(*) as count FROM mamaearth_rb_ms_olap WHERE DATE >= today() - 30 GROUP BY delivery_date ORDER BY count DESC LIMIT 5`);
            console.log(data);
        }
    } catch (e) {
        console.error(e);
    }
})();
