/**
 * ClickHouse -> PostgreSQL Master Sync
 *
 * Source: prestige.rb_sku_platform on the multi-tenant ClickHouse server
 * Target: masters.products (Postgres)
 *
 * Drop-in replacement for sync_mysql_master.cjs — the upstream Prestige
 * MySQL crawl DB has been retired. Same Postgres write path; only the
 * read source changes.
 *
 * Header mapping verified 2026-05-19 — every column the MySQL version
 * SELECTed is present in prestige.rb_sku_platform with the same name.
 *   - MOP keeps its upper-case spelling in ClickHouse (case-sensitive)
 *   - mrp is Nullable(String) here, was numeric in MySQL — Number() handles both
 *   - is_competitor is Nullable(Int32) here, was tinyint in MySQL — coerce
 *
 * Rules (unchanged from MySQL version):
 *   - company_id is env-scoped
 *   - Pareto source of truth is rb_sku_platform.sku_type
 *   - blank sku_type → Non-Pareto; existing NPD designations are sticky
 */
const { createClient } = require('@clickhouse/client');
const { Pool } = require('pg');
require('dotenv').config();

function requireEnv(name) {
    const value = process.env[name];
    if (!value) throw new Error(`Missing required environment variable: ${name}`);
    return value;
}

const pgPool = new Pool({
    host: requireEnv('DB_HOST'),
    database: requireEnv('DB_NAME'),
    user: requireEnv('DB_USER'),
    password: requireEnv('DB_PASSWORD'),
    port: parseInt(process.env.DB_PORT || '5432', 10),
    max: 5,
    ssl: process.env.DB_HOST && !['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST)
        ? { rejectUnauthorized: false } : false,
});

const COMPANY_ID = requireEnv('COMPANY_ID');
const chClient = createClient({
    url: requireEnv('CLICKHOUSE_HOST'),
    username: requireEnv('CLICKHOUSE_USER'),
    password: requireEnv('CLICKHOUSE_PASSWORD'),
    database: requireEnv('CLICKHOUSE_DATABASE'),
    request_timeout: 60_000,
});

const PLATFORM_MAP = {
    Amazon: 'amazon',
    Flipkart: 'flipkart',
    Blinkit: 'blinkit',
    Zepto: 'zepto',
    Instamart: 'instamart',
    JioMart: 'jiomart',
};

function cleanString(value) {
    if (value === null || value === undefined) return null;
    const cleaned = String(value).trim();
    if (!cleaned || cleaned === '0') return null;
    // ClickHouse exports literal-string junk like '\N', '\\N', '\n', '\\n'
    // (Postgres pg_dump / MySQL escape conventions leaked into the source).
    // Treat any of those as null so they don't pollute brand/category text.
    if (/^\\+[Nn]+$/.test(cleaned)) return null;
    return cleaned;
}

function canonicalizeCategory(value) {
    const cleaned = cleanString(value);
    if (!cleaned) return null;
    const normalized = cleaned.replace(/\s+/g, ' ');
    const lower = normalized.toLowerCase();
    const CANONICAL = { 'others': 'Others', 'other': 'Others', 'misc': 'Others', 'miscellaneous': 'Others' };
    if (CANONICAL[lower]) return CANONICAL[lower];
    return normalized.split(' ').map(w => w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w).join(' ');
}

function normalizePareto(value, existingPareto) {
    if (existingPareto === 'NPD') return 'NPD';
    const cleaned = cleanString(value);
    if (!cleaned) return existingPareto || 'Non-Pareto';
    // CH stores sku_type lower-cased ("pareto" / "non-pareto"); MySQL had it
    // title-cased. Compare case-insensitively so the 134 Pareto SKUs that
    // were silently downgraded to Non-Pareto get classified correctly.
    return cleaned.toLowerCase() === 'pareto' ? 'Pareto' : 'Non-Pareto';
}

function extractWattage(spec) {
    if (!spec) return null;
    const m = spec.match(/(\d+(?:\.\d+)?)\s*(kw|w|watt|watts)\b/i);
    if (!m) return null;
    let watts = parseFloat(m[1]);
    if (!Number.isFinite(watts) || watts <= 0) return null;
    if (/kw/i.test(m[2])) watts = watts * 1000;
    return `${Math.round(watts)}W`;
}

function extractCapacity(spec) {
    if (!spec) return null;
    const m = spec.match(/(\d+(?:\.\d+)?)\s*(l|ltr|litre|litres|liter|liters)\b/i);
    if (!m) return null;
    const litres = parseFloat(m[1]);
    if (!Number.isFinite(litres) || litres <= 0) return null;
    return `${Number.isInteger(litres) ? litres : litres.toFixed(1)}L`;
}

function parseSpec(value) {
    const spec = cleanString(value);
    if (!spec) return { wattage: null, capacity: null };
    const wattage = extractWattage(spec);
    const capacity = extractCapacity(spec);
    if (!wattage && !capacity) return { wattage: null, capacity: spec };
    return { wattage, capacity };
}

const SPECIFIC_TAXONOMY = new Set([
    'Pressure Cooker','Kadai','Fry Pan','Tawa','Dosa Tawa',
    'Other Cookware','Cookware','Cookware Set','Gas Stove',
    'Mixer Grinder','Kettle','Rice Cooker','Toaster & OTG','Air Fryer',
    'Wet Grinder','Induction Cooktop','Sandwich Maker','Grill & Sandwich Maker',
    'Hand Blender','Glasstops and Hobs','Food Processor','Juicer','Iron',
    'Waffle Maker','Air Oven','Combo','Bottle',
]);

function resolveCategory(brandCategory, existingMasterCategory) {
    if (existingMasterCategory && SPECIFIC_TAXONOMY.has(existingMasterCategory)) {
        return existingMasterCategory;
    }
    return canonicalizeCategory(brandCategory);
}

async function main() {
    console.log('=== ClickHouse -> PostgreSQL MASTER Sync ===');
    console.log(`Source: ${process.env.CLICKHOUSE_HOST} db=${process.env.CLICKHOUSE_DATABASE} table=rb_sku_platform`);

    // Note the lower-case `mop` alias for ClickHouse `MOP` (case-sensitive identifier).
    const rs = await chClient.query({
        query: `
            SELECT
                web_pid, sku_name, sku_title, platform_name, brand_name,
                brand_category, sub_category, sku_type, mrp, MOP AS mop,
                sku_qty, is_competitor, ean_code, rb_code, item_code
            FROM rb_sku_platform
            WHERE web_pid IS NOT NULL AND web_pid != ''
        `,
        format: 'JSONEachRow',
    });
    const chProducts = await rs.json();
    console.log(`Read ${chProducts.length} rows from ClickHouse`);

    const { rows: existingProducts } = await pgPool.query(`
        SELECT id, product_external_id, platform, pareto_status, master_category
        FROM masters.products
        WHERE company_id = $1
    `, [COMPANY_ID]);

    const existingLookup = new Map();
    for (const row of existingProducts) {
        existingLookup.set(`${row.product_external_id}|${row.platform || ''}`, row);
    }

    // NPD is set via Excel upload into ratings.sku_classifications — the
    // upstream crawl (MySQL or now ClickHouse) has never carried it. Load
    // the override map so master sync can both (a) apply NPD to existing
    // rows and (b) create stub rows for NPD SKUs the crawler hasn't reached
    // yet (common for newly-listed products).
    const { rows: skuClassRows } = await pgPool.query(`
        SELECT web_pid, lower(platform) AS platform, product_name, category,
               mrp, mop, pareto_status
        FROM ratings.sku_classifications
        WHERE company_id = $1 AND pareto_status IS NOT NULL
    `, [COMPANY_ID]);
    const npdOverride = new Map(); // key -> { product_name, category, mrp, mop }
    for (const r of skuClassRows) {
        if (r.pareto_status === 'NPD') {
            npdOverride.set(`${r.web_pid}|${r.platform}`, r);
        }
    }
    console.log(`NPD overrides loaded: ${npdOverride.size} from ratings.sku_classifications`);

    const pgClient = await pgPool.connect();
    let inserted = 0;
    let updated = 0;
    try {
        await pgClient.query('BEGIN');

        for (const product of chProducts) {
            const webPid = cleanString(product.web_pid);
            if (!webPid) continue;

            const platform = PLATFORM_MAP[product.platform_name] || cleanString(product.platform_name)?.toLowerCase();
            if (!platform) continue;

            const lookupKey = `${webPid}|${platform}`;
            const existing = existingLookup.get(lookupKey);
            const skuDescription = cleanString(product.sku_name) || cleanString(product.sku_title);
            const { wattage, capacity } = parseSpec(product.sku_qty);
            // NPD from Excel beats whatever the crawl says; otherwise normal
            // Pareto/Non-Pareto resolution applies.
            const npdHit = npdOverride.get(lookupKey);
            const paretoStatus = npdHit
                ? 'NPD'
                : normalizePareto(product.sku_type, existing?.pareto_status || null);
            const isCompetitor = product.is_competitor === 1 || product.is_competitor === '1';

            const params = [
                COMPANY_ID, webPid, skuDescription, skuDescription, platform,
                resolveCategory(product.brand_category, existing?.master_category || null),
                canonicalizeCategory(product.sub_category),
                cleanString(product.brand_name), paretoStatus,
                cleanString(product.mrp) ? Number(product.mrp) : null,
                product.mop != null ? Number(product.mop) : null,
                isCompetitor,
                cleanString(product.ean_code) || cleanString(product.rb_code) || cleanString(product.item_code),
                wattage, capacity,
            ];

            if (existing) {
                await pgClient.query(`
                    UPDATE masters.products
                    SET description = COALESCE($1, description),
                        category = COALESCE($2, category),
                        subcategory = COALESCE($3, subcategory),
                        brand_name = COALESCE($4, brand_name),
                        pareto_status = COALESCE($5, pareto_status),
                        mrp = COALESCE($6, mrp),
                        mop = COALESCE($7, mop),
                        is_competitor = $8,
                        sku_code = COALESCE($9, sku_code),
                        wattage = COALESCE($10, wattage),
                        capacity = COALESCE($11, capacity),
                        last_synced_at = NOW()
                    WHERE id = $12
                `, [params[2], params[5], params[6], params[7], params[8],
                    params[9], params[10], params[11], params[12], params[13],
                    params[14], existing.id]);
                updated++;
            } else {
                await pgClient.query(`
                    INSERT INTO masters.products (
                        company_id, product_external_id, product_name, description, platform,
                        category, subcategory, brand_name, pareto_status,
                        mrp, mop, is_competitor, sku_code, wattage, capacity
                    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
                `, params);
                inserted++;
            }
        }

        // NPD stubs — for any NPD-classified SKU that the upstream crawl
        // doesn't yet know about, insert a placeholder master row so the
        // dashboard's Pareto/NPD views can see them. Pulls product_name +
        // category from ratings.product_snapshots where available (the price
        // sync writes those rows separately).
        let npdInserted = 0;
        const { rows: snapBackfill } = await pgClient.query(`
            SELECT DISTINCT ON (web_pid, lower(platform))
                web_pid, lower(platform) AS platform,
                product_name, brand, category
            FROM ratings.product_snapshots
            WHERE company_id = $1
              AND web_pid IS NOT NULL
            ORDER BY web_pid, lower(platform), snapshot_date DESC
        `, [COMPANY_ID]);
        const snapByKey = new Map(snapBackfill.map(r => [`${r.web_pid}|${r.platform}`, r]));

        for (const [key, n] of npdOverride) {
            if (existingLookup.has(key)) continue; // already updated above
            const [webPid, platform] = key.split('|');
            const snap = snapByKey.get(key);
            const fallbackName = n.product_name || snap?.product_name || webPid;
            const fallbackCat = canonicalizeCategory(n.category) || canonicalizeCategory(snap?.category) || null;
            const fallbackBrand = snap?.brand || 'Prestige';
            await pgClient.query(`
                INSERT INTO masters.products (
                    company_id, product_external_id, product_name, description, platform,
                    category, brand_name, pareto_status,
                    mrp, mop, is_competitor, last_synced_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'NPD', $8, $9, false, NOW())
                ON CONFLICT DO NOTHING
            `, [
                COMPANY_ID, webPid, fallbackName, fallbackName, platform,
                fallbackCat, fallbackBrand,
                n.mrp != null ? Number(n.mrp) : null,
                n.mop != null ? Number(n.mop) : null,
            ]);
            npdInserted++;
        }
        if (npdInserted > 0) console.log(`NPD stubs inserted: ${npdInserted}`);

        await pgClient.query('COMMIT');
    } catch (error) {
        await pgClient.query('ROLLBACK');
        throw error;
    } finally {
        pgClient.release();
        await chClient.close();
        await pgPool.end();
    }

    console.log(`✓ Master sync done — inserted ${inserted}, updated ${updated}, total ${inserted + updated}`);
}

main().catch(e => { console.error('FAIL:', e.stack || e.message); process.exit(1); });
