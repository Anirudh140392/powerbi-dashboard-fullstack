import { queryClickHouse } from '../config/clickhouse.js';

async function check13200Tables() {
    console.log("Checking tables in database boat on 13.200.55.131:8123...");
    const tables = await queryClickHouse(`SHOW TABLES FROM boat`);
    console.log("Tables in boat:", tables.map(t => t.name));

    for (const t of tables) {
        const full = `boat.${t.name}`;
        try {
            const desc = await queryClickHouse(`DESCRIBE TABLE ${full}`);
            const dateCol = desc.find(c => c.name === 'created_on' || c.name === 'pdp_crawl_date' || c.name === 'DATE')?.name;
            if (dateCol) {
                const res = await queryClickHouse(`SELECT min(${dateCol}) as minD, max(${dateCol}) as maxD FROM ${full}`);
                console.log(`Table: ${full.padEnd(30)} | DateCol: ${dateCol.padEnd(15)} | Min: ${res[0]?.minD} | Max: ${res[0]?.maxD}`);
            }
        } catch {}
    }
    process.exit(0);
}

check13200Tables();
