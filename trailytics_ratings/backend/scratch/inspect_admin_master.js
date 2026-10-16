import clickhouse from '../src/config/clickhouse.js';

async function test() {
    try {
        console.log("Querying admin_master.tb_database from ratings backend ClickHouse client:");
        const res = await clickhouse.query({
            query: "SELECT db_name, toString(db_id) as db_id FROM admin_master.tb_database",
            format: 'JSONEachRow'
        });
        const rows = await res.json();
        console.log("Result rows:", rows);
    } catch (e) {
        console.error("Error querying admin_master.tb_database:", e.message);
    }
    process.exit(0);
}

test();
