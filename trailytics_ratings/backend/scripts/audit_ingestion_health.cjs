/**
 * Three-in-one audit:
 *   1. Alert digest — how many events still show "Uncategorised" or "—" previous rating?
 *   2. Every ratings.* writer — when did it last write a row?
 *   3. Tables in ratings.* that look dead (no row, no recent write, no recent read).
 */
require('dotenv').config();
const { Pool } = require('pg');

const pg = new Pool({
    host: process.env.DB_HOST, database: process.env.DB_NAME,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'), ssl: { rejectUnauthorized: false },
});
const CID = process.env.COMPANY_ID;

(async () => {
    console.log('===================================================================');
    console.log('  Q1 — alert_events: Uncategorised + missing previous_rating gaps');
    console.log('===================================================================');
    const total = await pg.query(`SELECT count(*)::int AS n FROM ratings.alert_events WHERE company_id=$1`, [CID]);
    const noCat = await pg.query(`SELECT count(*)::int AS n FROM ratings.alert_events WHERE company_id=$1 AND (category IS NULL OR category='')`, [CID]);
    const noPrev = await pg.query(`SELECT count(*)::int AS n FROM ratings.alert_events WHERE company_id=$1 AND previous_rating IS NULL`, [CID]);
    const noPareto = await pg.query(`SELECT count(*)::int AS n FROM ratings.alert_events WHERE company_id=$1 AND (pareto_status IS NULL OR pareto_status='')`, [CID]);
    const noCount = await pg.query(`SELECT count(*)::int AS n FROM ratings.alert_events WHERE company_id=$1 AND rating_count IS NULL`, [CID]);
    console.log(`  Total events                     : ${total.rows[0].n}`);
    console.log(`  NULL category (Uncategorised)    : ${noCat.rows[0].n} (${(noCat.rows[0].n / total.rows[0].n * 100).toFixed(1)}%)`);
    console.log(`  NULL previous_rating ('—' shown) : ${noPrev.rows[0].n} (${(noPrev.rows[0].n / total.rows[0].n * 100).toFixed(1)}%)`);
    console.log(`  NULL pareto_status               : ${noPareto.rows[0].n} (${(noPareto.rows[0].n / total.rows[0].n * 100).toFixed(1)}%)`);
    console.log(`  NULL rating_count                : ${noCount.rows[0].n} (${(noCount.rows[0].n / total.rows[0].n * 100).toFixed(1)}%)`);

    // Split events: pre-fix vs post-fix (commit added category+pareto+rating_count to evaluateRule in last 24h)
    const splitByAge = await pg.query(`
        SELECT
            CASE WHEN triggered_at > NOW() - INTERVAL '24 hours' THEN 'last 24h' ELSE 'older' END AS bucket,
            count(*)::int AS n,
            count(*) FILTER (WHERE category IS NULL OR category='')::int AS no_cat,
            count(*) FILTER (WHERE rating_count IS NULL)::int AS no_count
        FROM ratings.alert_events WHERE company_id=$1
        GROUP BY 1 ORDER BY 1
    `, [CID]);
    console.log('\n  Split by age:');
    for (const r of splitByAge.rows) console.log(`    ${r.bucket.padEnd(10)} n=${String(r.n).padStart(5)}  no_cat=${String(r.no_cat).padStart(4)}  no_rating_count=${String(r.no_count).padStart(4)}`);

    // Why? trace 5 recent Uncategorised events back to their source product
    console.log('\n  Sample 5 recent Uncategorised events — does the source product have category?');
    const samples = await pg.query(`
        SELECT ae.web_pid, ae.platform, ae.product_name,
               mp.category AS mp_cat, mp.master_category AS mp_mcat, mp.pareto_status AS mp_pareto,
               ps.category AS ps_cat, ps.pareto_status AS ps_pareto, ps.rating_count AS ps_count
        FROM ratings.alert_events ae
        LEFT JOIN masters.products mp ON mp.company_id=ae.company_id AND mp.product_external_id=ae.web_pid AND mp.platform=ae.platform
        LEFT JOIN LATERAL (
            SELECT category, pareto_status, rating_count FROM ratings.product_snapshots
            WHERE company_id=ae.company_id AND web_pid=ae.web_pid AND platform=ae.platform
            ORDER BY snapshot_date DESC LIMIT 1
        ) ps ON true
        WHERE ae.company_id=$1 AND (ae.category IS NULL OR ae.category='')
        ORDER BY ae.triggered_at DESC LIMIT 5
    `, [CID]);
    for (const s of samples.rows) {
        console.log(`    ${s.web_pid?.padEnd(18) || ''} @ ${(s.platform || '').padEnd(10)}  master.cat=${s.mp_cat || '(null)'}  snap.cat=${s.ps_cat || '(null)'}  master.pareto=${s.mp_pareto || '(null)'}`);
    }

    console.log('\n===================================================================');
    console.log('  Q2 — Per-table activity (when was each ratings.* last touched?)');
    console.log('===================================================================');
    const tables = await pg.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema='ratings' AND table_type='BASE TABLE'
        ORDER BY table_name
    `);
    console.log(`  ${'table'.padEnd(36)} ${'rows'.padStart(8)}  ${'most-recent timestamp col'.padEnd(25)} ${'last activity'}`);
    for (const { table_name } of tables.rows) {
        // Pick the most likely "freshness" column
        const colRes = await pg.query(`
            SELECT column_name FROM information_schema.columns
            WHERE table_schema='ratings' AND table_name=$1
              AND column_name IN ('updated_at','last_synced_at','last_activity_at','completed_at','triggered_at','created_at','snapshot_date','started_at')
            ORDER BY array_position(ARRAY['updated_at','last_synced_at','last_activity_at','completed_at','triggered_at','created_at','snapshot_date','started_at'], column_name)
            LIMIT 1
        `, [table_name]);
        const ts = colRes.rows[0]?.column_name;
        let n = 0, last = null;
        try {
            const c = await pg.query(`SELECT count(*)::int AS n FROM ratings.${table_name}`);
            n = c.rows[0].n;
            if (ts && n > 0) {
                const l = await pg.query(`SELECT max(${ts}) AS t FROM ratings.${table_name}`);
                last = l.rows[0].t;
            }
        } catch (_) {}
        const lastStr = last ? new Date(last).toISOString().slice(0, 16) : '(no rows or no ts col)';
        const ageDays = last ? Math.floor((Date.now() - new Date(last).getTime()) / 86400000) : null;
        const ageStr = ageDays != null ? ` (${ageDays}d ago)` : '';
        console.log(`  ${table_name.padEnd(36)} ${String(n).padStart(8)}  ${(ts || '(none)').padEnd(25)} ${lastStr}${ageStr}`);
    }

    console.log('\n===================================================================');
    console.log('  Q3 — Tables that look DEAD (0 rows OR not touched in >30 days)');
    console.log('===================================================================');
    const dead = [];
    for (const { table_name } of tables.rows) {
        const colRes = await pg.query(`
            SELECT column_name FROM information_schema.columns
            WHERE table_schema='ratings' AND table_name=$1
              AND column_name IN ('updated_at','last_synced_at','last_activity_at','completed_at','triggered_at','created_at','snapshot_date','started_at')
            ORDER BY array_position(ARRAY['updated_at','last_synced_at','last_activity_at','completed_at','triggered_at','created_at','snapshot_date','started_at'], column_name)
            LIMIT 1
        `, [table_name]);
        const ts = colRes.rows[0]?.column_name;
        try {
            const c = await pg.query(`SELECT count(*)::int AS n FROM ratings.${table_name}`);
            const n = c.rows[0].n;
            if (n === 0) { dead.push({ table_name, reason: 'empty (0 rows)' }); continue; }
            if (ts) {
                const l = await pg.query(`SELECT max(${ts}) AS t FROM ratings.${table_name}`);
                const last = l.rows[0].t;
                if (last && (Date.now() - new Date(last).getTime()) > 30 * 86400000) {
                    dead.push({ table_name, reason: `stale (>30d, last=${new Date(last).toISOString().slice(0, 10)}, ${n} rows)` });
                }
            }
        } catch (_) {}
    }
    for (const d of dead) console.log(`  ${d.table_name.padEnd(36)} ${d.reason}`);
    if (dead.length === 0) console.log('  (none — every table has been written in the last 30 days)');

    await pg.end();
})().catch(e => { console.error('FAIL:', e.stack || e.message); process.exit(1); });
