import { queryClickHouse } from './src/config/clickhouse.js';

async function checkSchema() {
    try {
        const rows = await queryClickHouse("SELECT name FROM system.columns WHERE table = 'rca_pm_olap' AND database = 'mars'");
        console.log("COLUMNS:");
        rows.forEach(r => console.log(r.name));
    } catch (e) {
        console.error(e);
    }
}
checkSchema().then(() => process.exit(0));
