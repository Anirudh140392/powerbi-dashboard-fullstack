import { queryClickHouse } from '../config/clickhouse.js';

async function checkAllDbs() {
    try {
        const dbs = await queryClickHouse("SHOW DATABASES");
        console.log("All databases:", dbs.map(d => d.name));

        for (const dbObj of dbs) {
            const dbName = dbObj.name;
            if (['system', 'information_schema', 'default'].includes(dbName)) continue;
            try {
                const tables = await queryClickHouse(`SHOW TABLES FROM ${dbName}`);
                const hasPdp = tables.some(t => t.name === 'rb_pdp');
                if (hasPdp) {
                    const minMax = await queryClickHouse(`SELECT min(created_on) as minC, max(created_on) as maxC, min(pdp_crawl_date) as minP, max(pdp_crawl_date) as maxP FROM ${dbName}.rb_pdp`);
                    console.log(`DB '${dbName}.rb_pdp' min/max:`, minMax);
                }
            } catch (err) {
                console.log(`DB '${dbName}' error:`, err.message);
            }
        }
    } catch (err) {
        console.error("Error:", err);
    }
}

checkAllDbs();
