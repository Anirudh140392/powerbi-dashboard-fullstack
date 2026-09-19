import { queryClickHouse } from '../config/clickhouse.js';

async function findSept10Tables() {
    const dbs = ['emami', 'boat', 'drl', 'pidilite', 'godrej', 'zydus'];
    for (const db of dbs) {
        try {
            const tables = await queryClickHouse(`SHOW TABLES FROM ${db}`);
            for (const t of tables) {
                const tableName = `${db}.${t.name}`;
                try {
                    const desc = await queryClickHouse(`DESCRIBE TABLE ${tableName}`);
                    const hasCreatedOn = desc.some(c => c.name === 'created_on' || c.name === 'pdp_crawl_date');
                    if (hasCreatedOn) {
                        const col = desc.some(c => c.name === 'created_on') ? 'created_on' : 'pdp_crawl_date';
                        const res = await queryClickHouse(`SELECT min(${col}) as minC, max(${col}) as maxC FROM ${tableName}`);
                        const minStr = String(res[0]?.minC || '');
                        if (minStr.includes('2026-09-10')) {
                            console.log(`FOUND Sept 10 table! ${tableName}:`, res[0]);
                        }
                    }
                } catch {}
            }
        } catch {}
    }
}

findSept10Tables();
