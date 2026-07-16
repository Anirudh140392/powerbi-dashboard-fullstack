/**
 * Hunt for the NPD (New Product Development) signal in ClickHouse.
 *
 * Background: validation showed 0 NPD SKUs after sync. The user expects ~20.
 * sku_type only carries 'pareto' / 'non-pareto' / junk — no NPD. Where is it?
 */
require('dotenv').config();
const { createClient } = require('@clickhouse/client');
const { Pool } = require('pg');

const ch = createClient({
    url: process.env.CLICKHOUSE_HOST,
    username: process.env.CLICKHOUSE_USER,
    password: process.env.CLICKHOUSE_PASSWORD,
    database: process.env.CLICKHOUSE_DB,
});
const pg = new Pool({
    host: process.env.DB_HOST, database: process.env.DB_NAME,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'), ssl: { rejectUnauthorized: false },
});

async function q(sql) {
    const rs = await ch.query({ query: sql, format: 'JSONEachRow' });
    return rs.json();
}

(async () => {
    // 1. Every string column — search for "npd" or "new" inside its values.
    console.log('=== 1) Scan every String column for "npd" / "new product" ===');
    const stringCols = await q(`SELECT name FROM system.columns WHERE database='prestige' AND table='rb_sku_platform' AND type LIKE '%String%'`);
    for (const { name } of stringCols) {
        const hits = await q(`SELECT count() AS n FROM rb_sku_platform WHERE lower(coalesce(\`${name}\`, '')) LIKE '%npd%'`);
        const newHits = await q(`SELECT count() AS n FROM rb_sku_platform WHERE lower(coalesce(\`${name}\`, '')) LIKE '%new product%'`);
        if (hits[0].n > 0 || newHits[0].n > 0) {
            console.log(`  ${name.padEnd(25)} npd:${hits[0].n}  new-product:${newHits[0].n}`);
        }
    }
    console.log('  (any column not listed had 0 matches)');

    // 2. status distribution (NPD might be flagged via status)
    console.log('\n=== 2) status distribution ===');
    for (const r of await q(`SELECT coalesce(toString(status), '(null)') AS v, count() AS n FROM rb_sku_platform GROUP BY v ORDER BY n DESC LIMIT 10`)) {
        console.log(`  ${JSON.stringify(r.v).padEnd(15)} ${r.n}`);
    }

    // 3. msl + cluster — might be int flags
    console.log('\n=== 3) msl distribution ===');
    for (const r of await q(`SELECT coalesce(toString(msl), '(null)') AS v, count() AS n FROM rb_sku_platform GROUP BY v ORDER BY n DESC LIMIT 10`)) {
        console.log(`  ${JSON.stringify(r.v).padEnd(15)} ${r.n}`);
    }
    console.log('\n=== 4) cluster distribution ===');
    for (const r of await q(`SELECT coalesce(toString(cluster), '(null)') AS v, count() AS n FROM rb_sku_platform GROUP BY v ORDER BY n DESC LIMIT 10`)) {
        console.log(`  ${JSON.stringify(r.v).padEnd(15)} ${r.n}`);
    }

    // 5. best_seller_category for the 134 Pareto SKUs — maybe NPD lives here
    console.log('\n=== 5) best_seller_category top 20 ===');
    for (const r of await q(`SELECT coalesce(best_seller_category, '(null)') AS v, count() AS n FROM rb_sku_platform GROUP BY v ORDER BY n DESC LIMIT 20`)) {
        console.log(`  ${JSON.stringify(r.v).slice(0, 40).padEnd(42)} ${r.n}`);
    }

    // 6. comp_mapp — competitor mapping flag, just to rule out
    console.log('\n=== 6) comp_mapp distribution ===');
    for (const r of await q(`SELECT coalesce(toString(comp_mapp), '(null)') AS v, count() AS n FROM rb_sku_platform GROUP BY v ORDER BY n DESC LIMIT 10`)) {
        console.log(`  ${JSON.stringify(r.v).padEnd(15)} ${r.n}`);
    }

    // 7. Check the existing NPD rows in Postgres — what was their CH sku_type?
    console.log('\n=== 7) Existing NPD rows in Postgres + their CH source row ===');
    const npdPg = await pg.query(`SELECT product_external_id, platform, product_name, mrp FROM masters.products WHERE company_id=$1 AND pareto_status='NPD' ORDER BY product_external_id LIMIT 30`, [process.env.COMPANY_ID]);
    console.log(`  NPD rows in PG: ${npdPg.rowCount}`);
    for (const r of npdPg.rows) {
        const ch = await q(`SELECT sku_type, status, best_seller_category, msl, cluster FROM rb_sku_platform WHERE web_pid='${r.product_external_id.replace(/'/g, "''")}' AND lower(platform_name)=lower('${r.platform}') LIMIT 1`);
        const chRow = ch[0] || null;
        console.log(`  ${r.product_external_id.padEnd(20)} @ ${r.platform.padEnd(10)}  ${r.product_name?.slice(0, 30).padEnd(32) || ''}  CH: ${chRow ? `sku_type=${JSON.stringify(chRow.sku_type)} status=${chRow.status} best=${JSON.stringify(chRow.best_seller_category).slice(0, 25)}` : 'NOT IN CH'}`);
    }

    // 8. Does CH have any other tables with NPD?
    console.log('\n=== 8) Any prestige.* table with NPD column or value ===');
    const tables = await q(`SELECT name FROM system.tables WHERE database='prestige'`);
    for (const { name } of tables) {
        const cols = await q(`SELECT name FROM system.columns WHERE database='prestige' AND table='${name}' AND lower(name) LIKE '%npd%'`);
        if (cols.length > 0) console.log(`  ${name}: column(s) ${cols.map(c => c.name).join(', ')}`);
    }

    await ch.close();
    await pg.end();
})().catch(e => { console.error('FAIL:', e.stack || e.message); process.exit(1); });
