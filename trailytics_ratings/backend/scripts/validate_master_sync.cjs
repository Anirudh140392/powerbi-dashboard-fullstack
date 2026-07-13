/**
 * End-to-end validation of sync_clickhouse_master.cjs.
 *
 * Compares prestige.rb_sku_platform (source) with masters.products (target)
 * along eight dimensions:
 *   1. Row counts (total, recent sync)
 *   2. Per-platform breakdown
 *   3. NULL coverage per column in Postgres
 *   4. Top categories in PG
 *   5. Pareto distribution
 *   6. is_competitor split
 *   7. Sample 5 SKUs — full column comparison
 *   8. Any CH rows missing in Postgres
 */
require('dotenv').config();
const { createClient } = require('@clickhouse/client');
const { Pool } = require('pg');

const ch = createClient({
    url: process.env.CLICKHOUSE_HOST,
    username: process.env.CLICKHOUSE_USER,
    password: process.env.CLICKHOUSE_PASSWORD,
    database: process.env.CLICKHOUSE_DATABASE,
});
const pg = new Pool({
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
    ssl: { rejectUnauthorized: false },
});
const CID = process.env.COMPANY_ID;

async function chQuery(sql) {
    const rs = await ch.query({ query: sql, format: 'JSONEachRow' });
    return rs.json();
}

(async () => {
    console.log('================================================================');
    console.log('  ClickHouse -> Postgres MASTER sync — end-to-end validation');
    console.log('================================================================\n');

    // 1) ROW COUNTS
    console.log('--- 1) Row counts ---');
    const chTotalAll = await chQuery(`SELECT count() AS n FROM rb_sku_platform`);
    const chTotal = await chQuery(`SELECT count() AS n FROM rb_sku_platform WHERE web_pid IS NOT NULL AND web_pid != ''`);
    const pgTotal = await pg.query(`SELECT count(*)::int AS n FROM masters.products WHERE company_id=$1`, [CID]);
    const pgRecent = await pg.query(`SELECT count(*)::int AS n FROM masters.products WHERE company_id=$1 AND last_synced_at > NOW() - INTERVAL '1 hour'`, [CID]);
    console.log(`  ClickHouse rb_sku_platform total       : ${chTotalAll[0].n}`);
    console.log(`  ClickHouse with web_pid (synced rows)  : ${chTotal[0].n}`);
    console.log(`  Postgres masters.products (all)        : ${pgTotal.rows[0].n}`);
    console.log(`  Postgres last_synced_at < 1h ago       : ${pgRecent.rows[0].n}  (should equal synced rows)`);
    const totalGap = Number(chTotal[0].n) - pgRecent.rows[0].n;
    console.log(`  -> GAP                                  : ${totalGap} ${totalGap === 0 ? 'OK' : 'WARN'}`);

    // 2) PER-PLATFORM BREAKDOWN
    console.log('\n--- 2) Per-platform row counts ---');
    const chPlat = await chQuery(`SELECT lower(coalesce(platform_name,'?')) AS p, count() AS n FROM rb_sku_platform WHERE web_pid IS NOT NULL AND web_pid != '' GROUP BY p ORDER BY n DESC`);
    const pgPlat = await pg.query(`SELECT platform AS p, count(*)::int AS n FROM masters.products WHERE company_id=$1 GROUP BY p ORDER BY n DESC`, [CID]);
    const pgMap = new Map(pgPlat.rows.map(r => [r.p, r.n]));
    console.log('  platform       CH        PG       gap');
    for (const r of chPlat) {
        const pgN = pgMap.get(r.p) || 0;
        const gap = Number(r.n) - pgN;
        console.log(`  ${(r.p || '').padEnd(13)} ${String(r.n).padStart(6)}  ${String(pgN).padStart(6)}  ${String(gap).padStart(6)} ${gap === 0 ? 'OK' : 'WARN'}`);
    }

    // 3) NULL COVERAGE per column
    console.log('\n--- 3) Postgres column NULL gaps ---');
    const cols = ['product_name', 'description', 'category', 'subcategory', 'brand_name', 'pareto_status', 'mrp', 'mop', 'sku_code', 'wattage', 'capacity'];
    for (const col of cols) {
        const { rows } = await pg.query(`SELECT count(*) FILTER (WHERE ${col} IS NULL)::int AS nulls, count(*)::int AS total FROM masters.products WHERE company_id=$1`, [CID]);
        const { nulls, total } = rows[0];
        const pct = ((total - nulls) / total * 100).toFixed(1);
        console.log(`  ${col.padEnd(15)} populated ${(total - nulls).toString().padStart(5)}/${total} (${pct}%)`);
    }

    // 4) CATEGORY DISTRIBUTION
    console.log('\n--- 4) Top 10 categories (post-sync) ---');
    const cats = await pg.query(`SELECT category, count(*)::int AS n FROM masters.products WHERE company_id=$1 AND category IS NOT NULL GROUP BY category ORDER BY n DESC LIMIT 10`, [CID]);
    for (const c of cats.rows) console.log(`  ${c.category.padEnd(28)} ${c.n}`);

    // 5) PARETO STATUS DISTRIBUTION
    console.log('\n--- 5) Pareto distribution ---');
    const pareto = await pg.query(`SELECT pareto_status, count(*)::int AS n FROM masters.products WHERE company_id=$1 GROUP BY pareto_status ORDER BY n DESC`, [CID]);
    for (const p of pareto.rows) console.log(`  ${(p.pareto_status || '(null)').padEnd(15)} ${p.n}`);

    // 6) COMPETITOR vs PRESTIGE
    console.log('\n--- 6) is_competitor split ---');
    const chCompCount = await chQuery(`SELECT is_competitor, count() AS n FROM rb_sku_platform WHERE web_pid IS NOT NULL GROUP BY is_competitor ORDER BY is_competitor`);
    const pgComp = await pg.query(`SELECT is_competitor, count(*)::int AS n FROM masters.products WHERE company_id=$1 GROUP BY is_competitor ORDER BY is_competitor`, [CID]);
    console.log('  CH:', chCompCount.map(r => `${r.is_competitor === 1 ? 'comp' : r.is_competitor === 0 ? 'prestige' : '?'}: ${r.n}`).join('  '));
    console.log('  PG:', pgComp.rows.map(r => `${r.is_competitor ? 'comp' : 'prestige'}: ${r.n}`).join('  '));

    // 7) SAMPLE 5 SKUs — full column compare
    console.log('\n--- 7) Sample 5 SKUs — CH vs PG column-by-column ---');
    const samples = await chQuery(`SELECT web_pid, lower(platform_name) AS platform_name, sku_name, sku_title, brand_name, brand_category, sub_category, sku_type, mrp, MOP, sku_qty, is_competitor, ean_code FROM rb_sku_platform WHERE web_pid IS NOT NULL AND is_competitor=0 ORDER BY web_pid LIMIT 5`);
    for (const s of samples) {
        console.log(`\n  - web_pid=${s.web_pid} platform=${s.platform_name}`);
        const { rows } = await pg.query(`SELECT product_name, description, category, subcategory, brand_name, pareto_status, mrp, mop, sku_code, is_competitor, wattage, capacity FROM masters.products WHERE company_id=$1 AND product_external_id=$2 AND platform=$3`, [CID, s.web_pid, s.platform_name]);
        if (rows.length === 0) { console.log('    NOT FOUND in Postgres'); continue; }
        const p = rows[0];
        const cmp = (lbl, chV, pgV) => console.log(`    ${lbl.padEnd(17)} CH: ${String(chV ?? '(null)').slice(0, 40).padEnd(42)} PG: ${String(pgV ?? '(null)').slice(0, 40)}`);
        cmp('product_name', s.sku_name, p.product_name);
        cmp('brand_name', s.brand_name, p.brand_name);
        cmp('category', s.brand_category, p.category);
        cmp('subcategory', s.sub_category, p.subcategory);
        cmp('mrp', s.mrp, p.mrp);
        cmp('mop', s.MOP, p.mop);
        cmp('sku_code (ean)', s.ean_code, p.sku_code);
        cmp('pareto (sku_type)', s.sku_type, p.pareto_status);
        cmp('is_competitor', s.is_competitor, p.is_competitor);
    }

    // 8) CH rows missing in Postgres
    console.log('\n--- 8) CH rows missing in Postgres ---');
    const chAll = await chQuery(`SELECT web_pid, lower(coalesce(platform_name,'')) AS platform FROM rb_sku_platform WHERE web_pid IS NOT NULL AND web_pid != ''`);
    const { rows: pgKeys } = await pg.query(`SELECT product_external_id, platform FROM masters.products WHERE company_id=$1`, [CID]);
    const pgSet = new Set(pgKeys.map(r => `${r.product_external_id}|${r.platform || ''}`));
    const missing = chAll.filter(r => !pgSet.has(`${r.web_pid}|${r.platform}`));
    console.log(`  Missing from Postgres: ${missing.length}`);
    for (const m of missing.slice(0, 10)) console.log(`    ${m.web_pid} @ ${m.platform}`);

    await pg.end();
    await ch.close();
    console.log('\n================== END OF VALIDATION ==================\n');
})().catch(e => { console.error('FAIL:', e.stack || e.message); process.exit(1); });
