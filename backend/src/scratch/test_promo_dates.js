import { queryClickHouse, getCurrentDbName } from '../config/clickhouse.js';
import { getTableColumns } from '../utils/schemaHelper.js';

async function checkTableExists(tableName) {
    try {
        const result = await queryClickHouse(`EXISTS TABLE ${tableName}`);
        return result && result[0] && result[0].result === 1;
    } catch { return false; }
}

async function testAllTables() {
    try {
        const currentDb = getCurrentDbName() || 'emami';
        console.log('Current DB:', currentDb);
        
        // Check all possible PDP table variants
        const tables = [
            `${currentDb}.rb_pdp`,
            'rb_pdp',
            'emami.rb_pdp',
            `${currentDb}.rb_pdp_olap`,
            'rb_pdp_olap',
            `${currentDb}.rb_pdp_week`,
            'rb_pdp_week',
        ];
        
        for (const table of tables) {
            const exists = await checkTableExists(table);
            if (exists) {
                const cols = await getTableColumns(table).catch(() => new Map());
                const dateCol = cols.has('created_on') ? 'created_on' : 'pdp_crawl_date';
                
                const q = `
                    SELECT 
                        formatDateTime(MIN(${dateCol}), '%Y-%m-%d') AS minDate, 
                        formatDateTime(MAX(${dateCol}), '%Y-%m-%d') AS maxDate,
                        count(*) as total
                    FROM ${table} 
                    WHERE platform_name IN ('dmart', 'metro', 'reliance retail', 'walmart') 
                      AND ${dateCol} IS NOT NULL
                `;
                const res = await queryClickHouse(q);
                console.log(`\n✅ Table: ${table} (dateCol=${dateCol})`);
                console.log(`   minDate=${res[0]?.minDate}, maxDate=${res[0]?.maxDate}, total=${res[0]?.total}`);
            } else {
                console.log(`\n❌ Table: ${table} — does NOT exist`);
            }
        }

        // Also check what tables exist in emami database
        console.log('\n\n--- All tables in emami database ---');
        const allTables = await queryClickHouse(`SELECT name FROM system.tables WHERE database = 'emami' AND name LIKE '%pdp%' ORDER BY name`);
        console.log('PDP tables in emami:', allTables.map(r => r.name));

        // Check boat database too
        console.log('\n--- All tables in boat database ---');
        const boatTables = await queryClickHouse(`SELECT name FROM system.tables WHERE database = 'boat' AND name LIKE '%pdp%' ORDER BY name`);
        console.log('PDP tables in boat:', boatTables.map(r => r.name));

    } catch (err) {
        console.error('Error:', err);
    }
    process.exit(0);
}

testAllTables();
