import clickhouse from './src/config/clickhouse.js';
async function run() {
    try {
        const rows = await clickhouse.query({ database: 'prestige', query: "DESCRIBE TABLE ml_reviews", format: 'JSONEachRow' });
        console.log(await rows.json());
        process.exit(0);
    } catch (e) { console.error(e); process.exit(1); }
}
run();
